// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createMigratedDb, watDate } from "./testDb";
import {
  CLIENT_RATE_LIMIT, handleAdminReschedule, handleClientCancel, handleClientReschedule, toRescheduleError,
  type CancelRpcResult, type RescheduleEnv, type RescheduleRepo, type RescheduleRpcResult,
} from "../_lib/reschedule";
import { planCancelNotifications, planRescheduleNotifications, type RenderedEmail } from "../_lib/rescheduleEmails";
import type { Database } from "../../src/types/database";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

let db: PGlite;

const BOOKING_COLUMNS = `id, client_name, client_phone, client_email, booking_date::text as booking_date, booking_time,
  status, client_reschedule_count, last_rescheduled_at::text as last_rescheduled_at`;

/** The production repo talks to Supabase over REST; this one runs the same queries against the
 * migrated PGlite database, so the handlers hit the real reschedule_booking() function. */
function pgliteRepo(database: PGlite): RescheduleRepo {
  return {
    async findBookingsByReference(ref) {
      const res = await database.query(`select ${BOOKING_COLUMNS} from bookings where reference_code = $1`, [ref]);
      return res.rows as unknown as BookingRow[];
    },
    async getBooking(id) {
      const res = await database.query(`select ${BOOKING_COLUMNS} from bookings where id = $1`, [id]);
      return (res.rows[0] as unknown as BookingRow) ?? null;
    },
    async getNoticeHours() {
      const res = await database.query<{ v: string }>("select value #>> '{}' as v from settings where key = 'min_booking_notice_hours'");
      return Number(res.rows[0]?.v ?? 0) || 0;
    },
    async getNessyPhone() {
      const res = await database.query<{ v: string }>("select value #>> '{}' as v from settings where key = 'phone'");
      return res.rows[0]?.v ?? null;
    },
    async reschedule(bookingId, date, time, actor, reason) {
      try {
        const res = await database.query<{ r: RescheduleRpcResult }>(
          "select reschedule_booking($1, $2::date, $3, $4, $5) as r", [bookingId, date, time, actor, reason],
        );
        return res.rows[0].r;
      } catch (err) {
        throw toRescheduleError(err as { code?: string; message?: string }) ?? err;
      }
    },
    async cancel(bookingId) {
      try {
        const res = await database.query<{ r: CancelRpcResult }>("select cancel_booking_by_id($1) as r", [bookingId]);
        return res.rows[0].r;
      } catch (err) {
        throw toRescheduleError(err as { code?: string; message?: string }) ?? err;
      }
    },
    async hitRateLimit(bucket, windowMs) {
      await database.query("insert into api_rate_limit_events (bucket) values ($1)", [bucket]);
      const res = await database.query<{ n: number }>(
        "select count(*)::int as n from api_rate_limit_events where bucket = $1 and created_at >= now() - make_interval(secs => $2)",
        [bucket, windowMs / 1000],
      );
      return res.rows[0].n;
    },
  };
}

let sent: RenderedEmail[];
let sendEmail: ReturnType<typeof vi.fn<(email: RenderedEmail) => Promise<void>>>;
let env: RescheduleEnv;
let ipCounter = 0;
/** A fresh IP per call by default, so only the rate-limit test ever trips the limit. */
const freshIp = () => `10.0.0.${++ipCounter}`;
const SITE = "https://nessy.test";

beforeAll(async () => {
  db = await createMigratedDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec(`
    delete from bookings;
    delete from blocked_slots;
    delete from api_rate_limit_events;
    update schedule_defaults set is_open = true, start_hour = 9, end_hour = 17, max_slots_per_day = 3, min_gap_hours = 3;
    update settings set value = '24' where key = 'min_booking_notice_hours';
  `);
  sent = [];
  sendEmail = vi.fn(async (email: RenderedEmail) => { sent.push(email); });
  env = {
    repo: pgliteRepo(db),
    sendEmail,
    adminEmail: "nessy@example.com",
    verifyAdminToken: async (token) => token === "valid-admin",
    now: () => Date.now(),
  };
});

async function seed(opts: { date?: string; time?: string; status?: string; email?: string | null; count?: number } = {}) {
  const res = await db.query<{ id: string; reference_code: string }>(
    `insert into bookings (client_name, client_phone, client_email, booking_date, booking_time, status, client_reschedule_count)
     values ('Ada', '08161271343', $1, $2, $3, $4, $5) returning id, reference_code`,
    [opts.email === undefined ? "ada@example.com" : opts.email, opts.date ?? watDate(5), opts.time ?? "10:00 AM", opts.status ?? "confirmed", opts.count ?? 0],
  );
  return { id: res.rows[0].id, reference: `BK-${res.rows[0].reference_code}` };
}

const clientReschedule = (body: Record<string, unknown>, ip = freshIp()) => handleClientReschedule(env, body, ip, SITE);

describe("reschedule-client — verification", () => {
  it("returns the same NOT_FOUND for a wrong phone, a wrong email and an unknown reference", async () => {
    const { reference } = await seed();
    const wrongPhone = await clientReschedule({ action: "check", reference, phone: "08000000000" });
    const wrongEmail = await clientReschedule({ action: "check", reference, email: "eve@example.com" });
    const unknownRef = await clientReschedule({ action: "check", reference: "BK-FFFFFFFF", phone: "08161271343" });
    for (const res of [wrongPhone, wrongEmail, unknownRef]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    }
    expect(wrongPhone.body).toEqual(wrongEmail.body);
    expect(wrongPhone.body).toEqual(unknownRef.body);
  });

  it("rejects a wrong phone on an actual reschedule too, without moving the booking", async () => {
    const { id, reference } = await seed();
    const res = await clientReschedule({ reference, phone: "08000000000", newDate: watDate(6), newTime: "2:00 PM" });
    expect(res.body.code).toBe("NOT_FOUND");
    const row = await db.query<{ d: string }>("select booking_date::text as d from bookings where id = $1", [id]);
    expect(row.rows[0].d).toBe(watDate(5));
  });

  it("accepts the phone in any common Nigerian format, and the email in any case", async () => {
    const { reference } = await seed();
    for (const proof of [{ phone: "+234 816 127 1343" }, { phone: "0816-127-1343" }, { email: "  ADA@Example.COM " }]) {
      const res = await clientReschedule({ action: "check", reference: reference.toLowerCase(), ...proof });
      expect(res.status).toBe(200);
    }
  });

  it("rejects a request with no contact proof", async () => {
    const { reference } = await seed();
    expect((await clientReschedule({ action: "check", reference })).body.code).toBe("INVALID_REQUEST");
  });

  it(`rate-limits by IP after ${CLIENT_RATE_LIMIT.max} requests`, async () => {
    const { reference } = await seed();
    const ip = "203.0.113.9";
    for (let i = 0; i < CLIENT_RATE_LIMIT.max; i++) {
      expect((await clientReschedule({ action: "check", reference, phone: "08000000000" }, ip)).status).toBe(404);
    }
    const blocked = await clientReschedule({ action: "check", reference, phone: "08161271343" }, ip);
    expect(blocked).toMatchObject({ status: 429, body: { code: "RATE_LIMITED" } });
    expect((await clientReschedule({ action: "check", reference, phone: "08161271343" }, "203.0.113.10")).status).toBe(200);
  });
});

describe("reschedule-client — eligibility check", () => {
  it("reports 2 of 2 remaining on a fresh booking", async () => {
    const { reference } = await seed();
    const res = await clientReschedule({ action: "check", reference, phone: "08161271343" });
    expect(res.body).toMatchObject({ ok: true, eligibility: { eligible: true, reason: null, remaining: 2 }, noticeHours: 24 });
  });

  it("reports LIMIT_REACHED and TOO_LATE without changing anything", async () => {
    const maxed = await seed({ count: 2 });
    expect((await clientReschedule({ action: "check", reference: maxed.reference, phone: "08161271343" })).body)
      .toMatchObject({ eligibility: { eligible: false, reason: "LIMIT_REACHED", remaining: 0 } });

    await db.exec("update settings set value = '72' where key = 'min_booking_notice_hours'");
    const soon = await seed({ date: watDate(2), time: "9:00 AM" });
    expect((await clientReschedule({ action: "check", reference: soon.reference, phone: "08161271343" })).body)
      .toMatchObject({ eligibility: { eligible: false, reason: "TOO_LATE" } });
  });
});

describe("reschedule-client — rescheduling", () => {
  it("moves the booking, writes the audit row, and emails the client and Nessy", async () => {
    const { id, reference } = await seed();
    const res = await clientReschedule({ reference, phone: "08161271343", newDate: watDate(6), newTime: "2:00 PM" });
    expect(res).toMatchObject({
      status: 200,
      body: { ok: true, booking: { date: watDate(6), time: "2:00 PM" }, previous: { date: watDate(5), time: "10:00 AM" }, remaining: 1, notifications: { clientEmail: "sent" } },
    });

    const audit = await db.query("select rescheduled_by from booking_reschedules where booking_id = $1", [id]);
    expect(audit.rows).toEqual([{ rescheduled_by: "client" }]);

    expect(sent.map(e => [e.to, e.subject])).toEqual([
      ["ada@example.com", "Your Nessy Hairlon appointment has been rescheduled"],
      ["nessy@example.com", "Client rescheduled: Ada"],
    ]);
    const adminMail = sent[1].html;
    expect(adminMail).toContain("08161271343");
    expect(adminMail).toContain("1 of 2");
    expect(sent[0].html).toContain(`${SITE}/track`);
  });

  it("maps a taken slot to 409 SLOT_UNAVAILABLE and sends nothing", async () => {
    const { reference } = await seed();
    await seed({ date: watDate(6), time: "2:00 PM" });
    const res = await clientReschedule({ reference, phone: "08161271343", newDate: watDate(6), newTime: "2:00 PM" });
    expect(res).toMatchObject({ status: 409, body: { code: "SLOT_UNAVAILABLE" } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("maps the third client reschedule to 422 LIMIT_REACHED", async () => {
    const { reference } = await seed({ count: 2 });
    const res = await clientReschedule({ reference, phone: "08161271343", newDate: watDate(6), newTime: "2:00 PM" });
    expect(res).toMatchObject({ status: 422, body: { code: "LIMIT_REACHED", remaining: 0 } });
  });

  it("maps a cancelled booking to 422 INVALID_STATUS", async () => {
    const { reference } = await seed({ status: "cancelled" });
    const res = await clientReschedule({ reference, phone: "08161271343", newDate: watDate(6), newTime: "2:00 PM" });
    expect(res).toMatchObject({ status: 422, body: { code: "INVALID_STATUS" } });
  });

  it("rejects a malformed date/time before touching the database", async () => {
    const { reference } = await seed();
    const res = await clientReschedule({ reference, phone: "08161271343", newDate: "next tuesday", newTime: "2:00 PM" });
    expect(res).toMatchObject({ status: 400, body: { code: "INVALID_REQUEST" } });
  });

  it("skips the client email when the client has none, but still alerts Nessy", async () => {
    const { reference } = await seed({ email: null });
    const res = await clientReschedule({ reference, phone: "08161271343", newDate: watDate(6), newTime: "2:00 PM" });
    expect(res.body).toMatchObject({ ok: true, notifications: { clientEmail: "no_email" } });
    expect(sent.map(e => e.to)).toEqual(["nessy@example.com"]);
  });
});

describe("reschedule-admin", () => {
  const adminReschedule = (body: Record<string, unknown>, auth: string | undefined = "Bearer valid-admin") =>
    handleAdminReschedule(env, body, auth, SITE);

  it("requires a valid admin token", async () => {
    const { id } = await seed();
    const body = { bookingId: id, newDate: watDate(6), newTime: "2:00 PM" };
    // Called directly: passing undefined to adminReschedule would fall back to its default token.
    expect((await handleAdminReschedule(env, body, undefined, SITE)).status).toBe(401);
    expect((await adminReschedule(body, "valid-admin")).status).toBe(401);
    expect((await adminReschedule(body, "Bearer forged")).status).toBe(401);
  });

  it("bypasses the client limits without bumping the count, and emails the client the reason", async () => {
    await db.exec("update settings set value = '72' where key = 'min_booking_notice_hours'");
    const { id } = await seed({ date: watDate(2), time: "9:00 AM", count: 2 });
    const res = await adminReschedule({ bookingId: id, newDate: watDate(1), newTime: "4:00 PM", reason: "Nessy is travelling" });
    expect(res).toMatchObject({ status: 200, body: { ok: true, reason: "Nessy is travelling", notifications: { clientEmail: "sent", adminEmail: "sent", whatsappUrl: null } } });

    const row = await db.query<{ n: number }>("select client_reschedule_count as n from bookings where id = $1", [id]);
    expect(row.rows[0].n).toBe(2);

    expect(sent.map(e => [e.to, e.subject.split(":")[0]])).toEqual([
      ["ada@example.com", "Nessy has moved your appointment"],
      ["nessy@example.com", "Rescheduled"],
    ]);
    expect(sent[0].html).toContain("Nessy is travelling");
    expect(sent[0].html).toContain("wa.me/");
  });

  it("still enforces availability for the admin", async () => {
    const { id } = await seed();
    await db.query("insert into blocked_slots (date, hour) values ($1, null)", [watDate(6)]);
    const res = await adminReschedule({ bookingId: id, newDate: watDate(6), newTime: "2:00 PM" });
    expect(res).toMatchObject({ status: 409, body: { code: "SLOT_UNAVAILABLE" } });
  });

  it("returns a prefilled WhatsApp link when the client has no email", async () => {
    const { id } = await seed({ email: null });
    const res = await adminReschedule({ bookingId: id, newDate: watDate(6), newTime: "2:00 PM", reason: "Sick day" });
    const notifications = res.body.notifications as { clientEmail: string; whatsappUrl: string };
    expect(notifications.clientEmail).toBe("no_email");
    expect(notifications.whatsappUrl).toMatch(/^https:\/\/wa\.me\/2348161271343\?text=/);
    const text = decodeURIComponent(notifications.whatsappUrl.split("text=")[1]);
    expect(text).toContain("10:00 AM");
    expect(text).toContain("2:00 PM");
    expect(text).toContain("Sick day");
    expect(sent.map(e => e.to)).toEqual(["nessy@example.com"]);
    expect(sent[0].html).toContain("no email");
  });

  it("returns NOT_FOUND for an unknown booking id", async () => {
    const res = await adminReschedule({ bookingId: "00000000-0000-0000-0000-000000000000", newDate: watDate(6), newTime: "2:00 PM" });
    expect(res).toMatchObject({ status: 404, body: { code: "NOT_FOUND" } });
  });
});

describe("notification failures never undo a reschedule", () => {
  it("keeps the move and reports the failure when email sending throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    env.sendEmail = vi.fn(async () => { throw new Error("Resend is down"); });
    const { id } = await seed();
    const res = await handleAdminReschedule(env, { bookingId: id, newDate: watDate(6), newTime: "2:00 PM" }, "Bearer valid-admin", SITE);
    expect(res.status).toBe(200);
    expect(res.body.notifications).toMatchObject({ clientEmail: "failed", adminEmail: "failed" });
    expect((res.body.notifications as { whatsappUrl: string | null }).whatsappUrl).toMatch(/wa\.me/);
    const row = await db.query<{ d: string }>("select booking_date::text as d from bookings where id = $1", [id]);
    expect(row.rows[0].d).toBe(watDate(6));
    errorSpy.mockRestore();
  });

  it("reports not_configured (and still succeeds) when email isn't set up at all", async () => {
    env.sendEmail = null;
    const { reference } = await seed();
    const res = await clientReschedule({ reference, phone: "08161271343", newDate: watDate(6), newTime: "2:00 PM" });
    expect(res.body).toMatchObject({ ok: true, notifications: { clientEmail: "not_configured" } });
  });
});

describe("planRescheduleNotifications", () => {
  it("routes a client reschedule to the client and Nessy", () => {
    expect(planRescheduleNotifications("client", "a@x.com", "n@x.com"))
      .toEqual({ clientEmail: "client_rescheduled_by_client", adminEmail: "admin_alert_client_rescheduled", whatsappNeeded: false });
  });

  it("routes an admin reschedule to the client plus a copy for Nessy", () => {
    expect(planRescheduleNotifications("admin", "a@x.com", "n@x.com"))
      .toEqual({ clientEmail: "client_rescheduled_by_admin", adminEmail: "admin_copy_admin_rescheduled", whatsappNeeded: false });
  });

  it("flags WhatsApp only for an admin reschedule of a client with no email", () => {
    expect(planRescheduleNotifications("admin", null, "n@x.com").whatsappNeeded).toBe(true);
    expect(planRescheduleNotifications("admin", "   ", "n@x.com").whatsappNeeded).toBe(true);
    expect(planRescheduleNotifications("client", null, "n@x.com")).toEqual({ clientEmail: null, adminEmail: "admin_alert_client_rescheduled", whatsappNeeded: false });
  });

  it("sends nothing to Nessy when no admin address is configured", () => {
    expect(planRescheduleNotifications("client", "a@x.com", null).adminEmail).toBeNull();
  });
});

const clientCancel = (body: Record<string, unknown>, ip = freshIp()) => handleClientCancel(env, body, ip, SITE);

async function statusOf(id: string): Promise<string> {
  const res = await db.query<{ status: string }>("select status from bookings where id = $1", [id]);
  return res.rows[0].status;
}

describe("cancel-client", () => {
  it("returns the same generic NOT_FOUND for a wrong phone, a wrong email and an unknown reference — and cancels nothing", async () => {
    const { id, reference } = await seed();
    const wrongPhone = await clientCancel({ reference, phone: "08000000000" });
    const wrongEmail = await clientCancel({ reference, email: "eve@example.com" });
    const unknownRef = await clientCancel({ reference: "BK-FFFFFFFF", phone: "08161271343" });
    for (const res of [wrongPhone, wrongEmail, unknownRef]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    }
    expect(wrongPhone.body).toEqual(wrongEmail.body);
    expect(wrongPhone.body).toEqual(unknownRef.body);
    expect(await statusOf(id)).toBe("confirmed");
    expect(sent).toHaveLength(0);
  });

  it("cancels with the phone in any common format, or with the email in any case", async () => {
    const byPhone = await seed({ time: "10:00 AM" });
    const byEmail = await seed({ time: "2:00 PM" });
    const phoneRes = await clientCancel({ reference: byPhone.reference.toLowerCase(), phone: "+234 816 127 1343" });
    const emailRes = await clientCancel({ reference: byEmail.reference, email: "ADA@Example.com" });
    expect(phoneRes.status).toBe(200);
    expect(emailRes.status).toBe(200);
    expect(await statusOf(byPhone.id)).toBe("cancelled");
    expect(await statusOf(byEmail.id)).toBe("cancelled");
  });

  it("emails the client and Nessy, with the status it had before", async () => {
    const { reference } = await seed({ status: "deposit_paid" });
    const res = await clientCancel({ reference, phone: "08161271343" });
    expect(res.body).toMatchObject({ ok: true, booking: { status: "cancelled" }, notifications: { clientEmail: "sent" } });
    expect(sent.map(e => e.to)).toEqual(["ada@example.com", "nessy@example.com"]);
    expect(sent[1].subject).toBe("Client cancelled: Ada");
    expect(sent[1].html).toContain("Status before cancelling: <strong>Payment Verification</strong> — a deposit may have been paid");
  });

  it("still alerts Nessy when the client has no email", async () => {
    const { reference } = await seed({ email: null });
    const res = await clientCancel({ reference, phone: "08161271343" });
    expect(res.body).toMatchObject({ ok: true, notifications: { clientEmail: "no_email" } });
    expect(sent.map(e => e.to)).toEqual(["nessy@example.com"]);
  });

  it("refuses completed and already-cancelled bookings with a cancel-specific message", async () => {
    for (const status of ["completed", "cancelled"]) {
      const { reference } = await seed({ status, time: status === "completed" ? "10:00 AM" : "2:00 PM" });
      const res = await clientCancel({ reference, phone: "08161271343" });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: "INVALID_STATUS", message: "This booking can no longer be cancelled online." });
    }
    expect(sent).toHaveLength(0);
  });

  it("rejects a request with no contact proof", async () => {
    const { reference } = await seed();
    expect((await clientCancel({ reference })).status).toBe(400);
  });

  it("shares the per-IP rate limit with reschedule-client", async () => {
    const { id, reference } = await seed();
    for (let i = 0; i < CLIENT_RATE_LIMIT.max; i++) {
      await clientReschedule({ action: "check", reference: "BK-FFFFFFFF", phone: "08161271343" }, "10.9.9.9");
    }
    const res = await clientCancel({ reference, phone: "08161271343" }, "10.9.9.9");
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("RATE_LIMITED");
    expect(await statusOf(id)).toBe("confirmed");
  });

  it("keeps the cancellation and reports the failure when the email fails", async () => {
    const { id, reference } = await seed();
    env.sendEmail = vi.fn(async () => { throw new Error("validation_error: domain not verified"); });
    const res = await clientCancel({ reference, phone: "08161271343" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, notifications: { clientEmail: "failed" } });
    expect(await statusOf(id)).toBe("cancelled");
  });
});

describe("planCancelNotifications", () => {
  it("emails the client only when they have an email, and Nessy only when configured", () => {
    expect(planCancelNotifications("ada@example.com", "nessy@example.com"))
      .toEqual({ clientEmail: "client_cancelled_by_client", adminEmail: "admin_alert_client_cancelled" });
    expect(planCancelNotifications(null, "nessy@example.com"))
      .toEqual({ clientEmail: null, adminEmail: "admin_alert_client_cancelled" });
    expect(planCancelNotifications("ada@example.com", null))
      .toEqual({ clientEmail: "client_cancelled_by_client", adminEmail: null });
  });
});
