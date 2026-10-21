// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { runReminders, renderReminderEmail, type ReminderBookingRow, type ReminderRepo, type UnsentReminder } from "../_lib/reminderProcessor";
import { siteUrl, PRODUCTION_SITE_URL } from "../_lib/siteUrl";
import type { EmailMessage, EmailResult } from "../_lib/email";
import { buildReminderRows } from "../../src/lib/reminders";
import type { OrderStatus } from "../../src/types";

/** A UTC instant from a readable string — the cron fires at 05:00–05:59 UTC (06:00–06:59 WAT). */
const at = (iso: string) => Date.parse(iso);

interface StoredReminder { id: string; booking_id: string; reminder_type: string; sent_at: string | null }

/** In-memory booking_reminders + bookings with the same claim/release semantics as the real repo
 * (UPDATE … WHERE sent_at IS NULL / WHERE sent_at = <claim>). */
class FakeDb implements ReminderRepo {
  bookings = new Map<string, ReminderBookingRow>();
  reminders: StoredReminder[] = [];
  writes = 0;
  private seq = 0;

  addBooking(over: Partial<ReminderBookingRow> & { booking_date: string; booking_time: string }): ReminderBookingRow {
    const id = `b${String(++this.seq).padStart(7, "0")}-0000-4000-8000-000000000000`;
    const b: ReminderBookingRow = { id, client_name: "Ada Obi", client_email: "ada@example.com", status: "confirmed", service_ids: [], ...over };
    this.bookings.set(id, b);
    return b;
  }
  addReminders(b: ReminderBookingRow, types: string[] = ["24h_before", "2h_before"]) {
    for (const t of types) this.reminders.push({ id: `r${++this.seq}`, booking_id: b.id, reminder_type: t, sent_at: null });
  }
  unsent(bookingId?: string) {
    return this.reminders.filter(r => r.sent_at === null && (!bookingId || r.booking_id === bookingId));
  }
  async fetchUnsent(): Promise<UnsentReminder[]> {
    return this.reminders.filter(r => r.sent_at === null)
      .map(r => ({ id: r.id, booking_id: r.booking_id, reminder_type: r.reminder_type, booking: this.bookings.get(r.booking_id) ?? null }));
  }
  async claim(id: string, when: string) {
    const r = this.reminders.find(x => x.id === id);
    if (!r || r.sent_at !== null) return false;
    r.sent_at = when; this.writes++;
    return true;
  }
  async release(id: string, when: string) {
    const r = this.reminders.find(x => x.id === id);
    if (r && r.sent_at === when) { r.sent_at = null; this.writes++; }
  }
  async serviceNames() { return ["Knotless Braids"]; }
  async settings() { return { phone: "0816 127 1343", locationUrl: "https://maps.app.goo.gl/nessy" }; }
}

let db: FakeDb;
let outbox: EmailMessage[];
let failNext: number;
const send = async (m: EmailMessage): Promise<EmailResult> => {
  if (failNext > 0) { failNext--; return { ok: false, error: "rate_limit_exceeded: Too many requests" }; }
  outbox.push(m);
  return { ok: true, id: `email_${outbox.length}` };
};
const SITE = PRODUCTION_SITE_URL;
const run = (iso: string, dryRun = false) => runReminders({ repo: db, send, siteUrl: SITE, now: at(iso), dryRun });

beforeEach(() => {
  db = new FakeDb();
  outbox = [];
  failNext = 0;
});

describe("the morning run, whenever in the 05:00–05:59 UTC window it fires", () => {
  for (const fireAt of ["05:00:00", "05:59:59"]) {
    for (const time of ["10:00 AM", "12:00 PM", "4:00 PM"]) {
      it(`day before (${fireAt} UTC): sends the 'tomorrow' email for a ${time} appointment, holds the morning-of one`, async () => {
        const b = db.addBooking({ booking_date: "2026-10-23", booking_time: time });
        db.addReminders(b);
        const res = await run(`2026-10-22T${fireAt}Z`);
        expect(res).toMatchObject({ sent: 1, waiting: 1, skipped: 0, failed: 0 });
        expect(outbox[0].subject).toBe("Reminder: your Nessy Hairlon appointment is tomorrow");
        expect(outbox[0].html).toContain("See you tomorrow!");
        expect(db.unsent(b.id).map(r => r.reminder_type)).toEqual(["2h_before"]);
      });

      it(`appointment day (${fireAt} UTC): sends the 'today' email for a ${time} appointment`, async () => {
        const b = db.addBooking({ booking_date: "2026-10-23", booking_time: time });
        db.addReminders(b, ["2h_before"]);
        const res = await run(`2026-10-23T${fireAt}Z`);
        expect(res).toMatchObject({ sent: 1, failed: 0 });
        expect(outbox[0].subject).toBe("Reminder: your Nessy Hairlon appointment is today");
        expect(outbox[0].html).toContain(`See you today at ${time}!`);
      });
    }
  }

  it("a 'tomorrow' row still unsent on the appointment day is skipped, never sent", async () => {
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "4:00 PM" });
    db.addReminders(b, ["24h_before"]);
    const res = await run("2026-10-23T05:00:00Z");
    expect(res).toMatchObject({ sent: 0, skipped: 1 });
    expect(res.rows[0].reason).toMatch(/send day 2026-10-22 has passed/);
    expect(outbox).toHaveLength(0);
    expect(db.unsent()).toHaveLength(0);
  });

  it("leaves rows whose send day is still ahead completely untouched", async () => {
    const b = db.addBooking({ booking_date: "2026-11-02", booking_time: "10:00 AM" });
    db.addReminders(b);
    const res = await run("2026-10-22T05:00:00Z");
    expect(res).toMatchObject({ sent: 0, skipped: 0, waiting: 2 });
    expect(res.rows.map(r => r.reason)).toEqual(["due on 2026-11-01", "due on 2026-11-02"]);
    expect(db.writes).toBe(0);
  });
});

describe("never a reminder for an appointment that has started or passed", () => {
  it("skips stale rows from past appointments (the 19 Oct 12 PM case)", async () => {
    const b = db.addBooking({ booking_date: "2026-10-19", booking_time: "12:00 PM" });
    db.addReminders(b);
    const res = await run("2026-10-20T05:53:00Z");
    expect(res).toMatchObject({ sent: 0, skipped: 2 });
    expect(res.rows.every(r => r.reason === "appointment has already started or passed")).toBe(true);
    expect(outbox).toHaveLength(0);
  });

  it("skips a same-day row once the appointment has started (a late manual run)", async () => {
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM" });
    db.addReminders(b, ["2h_before"]);
    const res = await run("2026-10-23T09:30:00Z"); // 10:30 WAT
    expect(res).toMatchObject({ sent: 0, skipped: 1 });
    expect(outbox).toHaveLength(0);
  });
});

describe("rescheduled bookings follow the CURRENT date, not the old rows' scheduled_for", () => {
  it("doesn't send for the old date, and honours the new one", async () => {
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM" });
    db.addReminders(b); // written for the 23rd
    b.booking_date = "2026-10-26"; // moved by the client/admin
    expect(await run("2026-10-22T05:00:00Z")).toMatchObject({ sent: 0, waiting: 2 });
    expect(await run("2026-10-23T05:00:00Z")).toMatchObject({ sent: 0, waiting: 2 });
    expect(await run("2026-10-25T05:00:00Z")).toMatchObject({ sent: 1, waiting: 1 });
    expect(await run("2026-10-26T05:00:00Z")).toMatchObject({ sent: 1 });
    expect(outbox.map(m => m.subject)).toEqual([
      "Reminder: your Nessy Hairlon appointment is tomorrow",
      "Reminder: your Nessy Hairlon appointment is today",
    ]);
    expect(outbox[0].html).toContain("Monday, 26 October 2026");
  });
});

describe("skipped bookings", () => {
  it.each([["cancelled"], ["completed"]] as [OrderStatus][])("%s: marked handled, never sent, even before the send day", async (status) => {
    const b = db.addBooking({ booking_date: "2026-10-30", booking_time: "10:00 AM", status });
    db.addReminders(b);
    const res = await run("2026-10-22T05:00:00Z");
    expect(res).toMatchObject({ sent: 0, skipped: 2 });
    expect(res.rows[0].reason).toBe(`booking ${status}`);
    expect(db.unsent()).toHaveLength(0);
  });

  it.each([["quoted"], ["deposit_paid"], ["pending_review"]] as [OrderStatus][])("%s on the send day: skipped; before it: left to wait", async (status) => {
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM", status });
    db.addReminders(b);
    const res = await run("2026-10-22T05:00:00Z");
    expect(res.rows.find(r => r.type === "24h_before")).toMatchObject({ action: "skipped", reason: `booking not confirmed (${status})` });
    expect(res.rows.find(r => r.type === "2h_before")).toMatchObject({ action: "waiting" });
    expect(outbox).toHaveLength(0);
  });

  it("no client email: skipped on the send day", async () => {
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM", client_email: null });
    db.addReminders(b, ["24h_before"]);
    const res = await run("2026-10-22T05:00:00Z");
    expect(res.rows[0]).toMatchObject({ action: "skipped", reason: "no client email" });
    expect(outbox).toHaveLength(0);
  });

  it("a deleted booking or unknown type is skipped", async () => {
    db.reminders.push({ id: "orphan", booking_id: "gone", reminder_type: "24h_before", sent_at: null });
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM" });
    db.addReminders(b, ["1w_before"]);
    const res = await run("2026-10-22T05:00:00Z");
    expect(res.rows.map(r => r.reason)).toEqual(["booking no longer exists", 'unknown reminder type "1w_before"']);
  });
});

describe("retries and repeat runs", () => {
  it("a failed send stays unsent and is retried next run only if still valid", async () => {
    const dayBefore = db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM" });
    db.addReminders(dayBefore, ["24h_before"]);
    failNext = 1;
    const first = await run("2026-10-22T05:00:00Z");
    expect(first).toMatchObject({ sent: 0, failed: 1, success: false });
    expect(first.rows[0].reason).toContain("rate_limit_exceeded");
    expect(db.unsent(dayBefore.id)).toHaveLength(1);
    // Next day's run: it's now the appointment day, so the 'tomorrow' email is no longer valid.
    const next = await run("2026-10-23T05:00:00Z");
    expect(next.rows[0]).toMatchObject({ action: "skipped" });
    expect(outbox).toHaveLength(0);
  });

  it("a failed morning-of send is retried by a later run the same day, before the appointment", async () => {
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "4:00 PM" });
    db.addReminders(b, ["2h_before"]);
    failNext = 1;
    expect(await run("2026-10-23T05:00:00Z")).toMatchObject({ failed: 1 });
    expect(await run("2026-10-23T05:59:00Z")).toMatchObject({ sent: 1 });
    expect(outbox).toHaveLength(1);
  });

  it("running twice in one day never double-sends", async () => {
    for (const time of ["10:00 AM", "12:00 PM"]) db.addReminders(db.addBooking({ booking_date: "2026-10-23", booking_time: time }));
    expect(await run("2026-10-22T05:00:00Z")).toMatchObject({ sent: 2 });
    expect(await run("2026-10-22T05:30:00Z")).toMatchObject({ sent: 0 });
    expect(outbox).toHaveLength(2);
  });

  it("overlapping runs: a row another run already claimed is not sent again", async () => {
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM" });
    db.addReminders(b, ["24h_before"]);
    const stale = await db.fetchUnsent(); // what a second, overlapping run fetched
    await run("2026-10-22T05:00:00Z");
    const overlapping = await runReminders({ repo: { ...db, fetchUnsent: async () => stale, claim: db.claim.bind(db), release: db.release.bind(db), serviceNames: db.serviceNames, settings: db.settings }, send, siteUrl: SITE, now: at("2026-10-22T05:00:01Z"), dryRun: false });
    expect(overlapping.rows[0]).toMatchObject({ action: "skipped", reason: "already handled by another run" });
    expect(outbox).toHaveLength(1);
  });

  it("two unsent rows for the same booking and type send one email", async () => {
    const b = db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM" });
    db.addReminders(b, ["24h_before", "24h_before"]);
    const res = await run("2026-10-22T05:00:00Z");
    expect(res).toMatchObject({ sent: 1, skipped: 1 });
    expect(outbox).toHaveLength(1);
  });
});

describe("month and year boundaries", () => {
  it("31 Dec morning sends the 'tomorrow' email for 1 Jan", async () => {
    const b = db.addBooking({ booking_date: "2027-01-01", booking_time: "10:00 AM" });
    db.addReminders(b);
    expect(await run("2026-12-31T05:00:00Z")).toMatchObject({ sent: 1, waiting: 1 });
    expect(outbox[0].html).toContain("Friday, 1 January 2027");
    expect(await run("2027-01-01T05:00:00Z")).toMatchObject({ sent: 1 });
  });

  it("31 Oct morning sends the 'tomorrow' email for 1 Nov", async () => {
    const b = db.addBooking({ booking_date: "2026-11-01", booking_time: "12:00 PM" });
    db.addReminders(b, ["24h_before"]);
    expect(await run("2026-10-31T05:00:00Z")).toMatchObject({ sent: 1 });
  });
});

describe("dry run", () => {
  it("reports what would happen without sending or writing anything", async () => {
    db.addReminders(db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM" }));
    db.addReminders(db.addBooking({ booking_date: "2026-10-19", booking_time: "12:00 PM" }));
    const res = await run("2026-10-22T05:00:00Z", true);
    expect(res).toMatchObject({ dryRun: true, sent: 1, waiting: 1, skipped: 2, failed: 0 });
    expect(res.rows.map(r => r.action).sort()).toEqual(["waiting", "would_send", "would_skip", "would_skip"]);
    expect(outbox).toHaveLength(0);
    expect(db.writes).toBe(0);
    expect(db.unsent()).toHaveLength(4);
  });
});

describe("email content", () => {
  const booking = { id: "a1b2c3d4-0000-4000-8000-000000000000", client_name: "Ada", client_email: "ada@example.com", booking_date: "2026-10-19", booking_time: "12:00 PM", status: "confirmed" as const, service_ids: [] };
  const ctx = { siteUrl: SITE, phone: "0816 127 1343", locationUrl: "https://maps.app.goo.gl/nessy", serviceNames: ["Knotless Braids"] };

  it("shows the long date, the booked time, WhatsApp and track links, and the location link", () => {
    const { html } = renderReminderEmail("2h_before", booking, ctx);
    expect(html).toContain("Monday, 19 October 2026");
    expect(html).toContain("See you today at 12:00 PM!");
    expect(html).not.toContain("2026-10-19");
    expect(html).toContain("Message Nessy on WhatsApp");
    expect(html).toContain("https://wa.me/2348161271343?text=");
    expect(html).toContain(`href="${PRODUCTION_SITE_URL}/track"`);
    expect(html).toContain("View your booking");
    expect(html).toContain('Location: <a href="https://maps.app.goo.gl/nessy" style="color:#C49A6C;font-weight:600">Find us on Google Maps</a>');
    expect(html).not.toMatch(/reschedule/i);
  });

  it("shows plain 'Lagos, Nigeria' — no link — when no usable map URL is set", () => {
    for (const locationUrl of [null, "", "   ", "not a url", "http://insecure.example.com/map", 'https://x.com/"><script>']) {
      const { html } = renderReminderEmail("24h_before", booking, { ...ctx, locationUrl });
      expect(html).toContain("<p>Location: Lagos, Nigeria</p>");
      expect(html).not.toContain("Find us on Google Maps");
      expect(html).not.toContain("google.com/maps");
    }
  });
});

describe("canonical site URL", () => {
  const deploymentHost = "nessy-hairlon-8inusvxh9-wify-solutions.vercel.app";

  it("production always links to the real domain, whatever host served the request", () => {
    expect(siteUrl(deploymentHost, { VERCEL_ENV: "production", VERCEL_BRANCH_URL: "nessy-hairlon-git-master-wify-solutions.vercel.app" })).toBe(PRODUCTION_SITE_URL);
  });

  it("previews link to the branch URL, then the request host", () => {
    expect(siteUrl(deploymentHost, { VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "nessy-hairlon-git-preprod-wify-solutions.vercel.app" }))
      .toBe("https://nessy-hairlon-git-preprod-wify-solutions.vercel.app");
    expect(siteUrl("localhost:3000", {})).toBe("http://localhost:3000");
  });

  it("a production reminder contains no .vercel.app link", async () => {
    db.addReminders(db.addBooking({ booking_date: "2026-10-23", booking_time: "10:00 AM" }));
    await runReminders({ repo: db, send, siteUrl: siteUrl(deploymentHost, { VERCEL_ENV: "production" }), now: at("2026-10-22T05:00:00Z"), dryRun: false });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].html).not.toContain(".vercel.app");
  });
});

describe("scheduleReminders rows (buildReminderRows)", () => {
  const booking = { id: "b1", booking_date: "2026-10-23", booking_time: "10:00 AM" };

  it("records 00:00 WAT of each send day", () => {
    expect(buildReminderRows(booking, at("2026-10-20T12:00:00Z"))).toEqual([
      { booking_id: "b1", reminder_type: "24h_before", scheduled_for: "2026-10-21T23:00:00.000Z" },
      { booking_id: "b1", reminder_type: "2h_before", scheduled_for: "2026-10-22T23:00:00.000Z" },
    ]);
  });

  it("drops reminders whose send day has passed, and everything once the appointment has started", () => {
    expect(buildReminderRows(booking, at("2026-10-23T03:00:00Z")).map(r => r.reminder_type)).toEqual(["2h_before"]);
    expect(buildReminderRows(booking, at("2026-10-23T09:00:00Z"))).toEqual([]);
  });

  it("is the same whatever timezone the admin's browser is in", () => {
    const original = process.env.TZ;
    const results = ["UTC", "America/New_York", "Asia/Tokyo", "Africa/Lagos"].map(tz => {
      process.env.TZ = tz;
      return JSON.stringify(buildReminderRows(booking, at("2026-10-20T23:30:00Z")));
    });
    process.env.TZ = original;
    expect(new Set(results).size).toBe(1);
  });
});
