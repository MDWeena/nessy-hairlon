// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createMigratedDb, watDate } from "./testDb";

let db: PGlite;

interface BookingSeed {
  date: string;
  time: string;
  status?: string;
  count?: number;
}

async function insertBooking({ date, time, status = "confirmed", count = 0 }: BookingSeed): Promise<string> {
  const res = await db.query<{ id: string }>(
    `insert into bookings (client_name, client_phone, client_email, booking_date, booking_time, status, client_reschedule_count)
     values ('Ada', '08161271343', 'ada@example.com', $1, $2, $3, $4) returning id`,
    [date, time, status, count],
  );
  return res.rows[0].id;
}

type RescheduleOutcome = { ok: true; result: Record<string, unknown> } | { ok: false; code: string };

async function reschedule(id: string, date: string, time: string, actor: "client" | "admin", reason: string | null = null): Promise<RescheduleOutcome> {
  try {
    const res = await db.query<{ r: Record<string, unknown> }>(
      "select reschedule_booking($1, $2::date, $3, $4, $5) as r", [id, date, time, actor, reason],
    );
    return { ok: true, result: res.rows[0].r };
  } catch (err) {
    return { ok: false, code: (err as Error).message };
  }
}

/** What the legacy functions match on: the first 8 hex chars of the id. */
function legacyRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function asAnon(sql: string) {
  return db.exec(`set role anon; ${sql};`).finally(() => db.exec("reset role"));
}

async function bookingRow(id: string) {
  const res = await db.query<{ booking_date: string; booking_time: string; status: string; client_reschedule_count: number; last_rescheduled_at: Date | null; quoted_price: number | null }>(
    "select booking_date::text, booking_time, status, client_reschedule_count, last_rescheduled_at, quoted_price from bookings where id = $1", [id],
  );
  return res.rows[0];
}

// Every test runs twice: against 022 alone — the state production is in between applying 022
// and 023, with the legacy functions still live beside the new one — and with 023 applied.
describe.each(["022", "023"])("with migrations up to %s", (upTo) => {
  beforeAll(async () => {
    db = await createMigratedDb({ upTo });
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // A predictable schedule regardless of which weekday the suite runs on.
    await db.exec(`
      delete from bookings;
      delete from blocked_slots;
      update schedule_defaults set is_open = true, start_hour = 9, end_hour = 17, max_slots_per_day = 3, min_gap_hours = 3;
      update settings set value = '24' where key = 'min_booking_notice_hours';
    `);
  });

  describe("reschedule_booking — statuses", () => {
    for (const status of ["pending_review", "quoted", "deposit_paid", "confirmed"]) {
      it(`allows ${status}`, async () => {
        const id = await insertBooking({ date: watDate(5), time: "10:00 AM", status });
        const out = await reschedule(id, watDate(6), "2:00 PM", "client");
        expect(out.ok).toBe(true);
        const row = await bookingRow(id);
        expect(row.booking_date).toBe(watDate(6));
        expect(row.booking_time).toBe("2:00 PM");
        expect(row.status).toBe(status);
      });
    }

    for (const status of ["completed", "cancelled"]) {
      it(`blocks ${status} for both client and admin`, async () => {
        const id = await insertBooking({ date: watDate(5), time: "10:00 AM", status });
        expect(await reschedule(id, watDate(6), "2:00 PM", "client")).toEqual({ ok: false, code: "INVALID_STATUS" });
        expect(await reschedule(id, watDate(6), "2:00 PM", "admin")).toEqual({ ok: false, code: "INVALID_STATUS" });
      });
    }

    it("changes only the date and time — price, status and deposit stay put", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM", status: "quoted" });
      await db.query("update bookings set quoted_price = 25000 where id = $1", [id]);
      await reschedule(id, watDate(7), "1:00 PM", "client");
      const row = await bookingRow(id);
      expect(row.quoted_price).toBe(25000);
      expect(row.status).toBe("quoted");
    });

    it("returns NOT_FOUND for an unknown booking id", async () => {
      expect(await reschedule("00000000-0000-0000-0000-000000000000", watDate(6), "2:00 PM", "admin"))
        .toEqual({ ok: false, code: "NOT_FOUND" });
    });

    it("rejects moving to the exact same slot", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      expect(await reschedule(id, watDate(5), "10:00 AM", "admin")).toEqual({ ok: false, code: "SAME_SLOT" });
    });
  });

  describe("reschedule_booking — availability", () => {
    it("rejects a slot another booking already holds", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await insertBooking({ date: watDate(6), time: "2:00 PM" });
      expect(await reschedule(id, watDate(6), "2:00 PM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });

    it("rejects a slot inside another booking's minimum gap", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await insertBooking({ date: watDate(6), time: "2:00 PM" });
      expect(await reschedule(id, watDate(6), "12:00 PM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await reschedule(id, watDate(6), "11:00 AM", "admin")).toMatchObject({ ok: true });
    });

    it("rejects a day that's already at max_slots_per_day", async () => {
      await db.exec("update schedule_defaults set max_slots_per_day = 2, min_gap_hours = 1");
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await insertBooking({ date: watDate(6), time: "9:00 AM" });
      await insertBooking({ date: watDate(6), time: "5:00 PM" });
      expect(await reschedule(id, watDate(6), "1:00 PM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });

    it("ignores cancelled bookings when checking capacity, like the new-booking calendar", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await insertBooking({ date: watDate(6), time: "2:00 PM", status: "cancelled" });
      expect(await reschedule(id, watDate(6), "2:00 PM", "admin")).toMatchObject({ ok: true });
    });

    it("rejects a whole-day block and a single-hour block", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await db.query("insert into blocked_slots (date, hour) values ($1, null), ($2, 15)", [watDate(6), watDate(7)]);
      expect(await reschedule(id, watDate(6), "1:00 PM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await reschedule(id, watDate(7), "3:00 PM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await reschedule(id, watDate(7), "11:00 AM", "admin")).toMatchObject({ ok: true });
    });

    it("rejects a closed day and hours outside opening times", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await db.exec("update schedule_defaults set is_open = false");
      expect(await reschedule(id, watDate(6), "1:00 PM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      await db.exec("update schedule_defaults set is_open = true");
      expect(await reschedule(id, watDate(6), "8:00 AM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await reschedule(id, watDate(6), "6:00 PM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });

    it("rejects a malformed time label", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      expect(await reschedule(id, watDate(6), "10:30", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });

    it("allows moving to another time on the same day, even inside its own old slot's gap", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      const out = await reschedule(id, watDate(5), "11:00 AM", "client");
      expect(out.ok).toBe(true);
      expect((await bookingRow(id)).booking_time).toBe("11:00 AM");
    });

    it("doesn't count the booking being moved against its own day's capacity", async () => {
      await db.exec("update schedule_defaults set max_slots_per_day = 1");
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      expect(await reschedule(id, watDate(5), "3:00 PM", "client")).toMatchObject({ ok: true });
    });

    it("rejects a slot in the past even for the admin", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      expect(await reschedule(id, watDate(-1), "2:00 PM", "admin")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });
  });

  describe("reschedule_booking — client limits", () => {
    it("blocks a client when the CURRENT appointment is inside the notice window", async () => {
      await db.exec("update settings set value = '72' where key = 'min_booking_notice_hours'");
      const id = await insertBooking({ date: watDate(2), time: "9:00 AM" });
      expect(await reschedule(id, watDate(8), "2:00 PM", "client")).toEqual({ ok: false, code: "TOO_LATE" });
    });

    it("blocks a client from picking a NEW slot inside the notice window", async () => {
      await db.exec("update settings set value = '72' where key = 'min_booking_notice_hours'");
      const id = await insertBooking({ date: watDate(8), time: "9:00 AM" });
      expect(await reschedule(id, watDate(1), "2:00 PM", "client")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });

    it("blocks a client from moving beyond the 14-day booking window", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      expect(await reschedule(id, watDate(14), "2:00 PM", "client")).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await reschedule(id, watDate(13), "2:00 PM", "client")).toMatchObject({ ok: true });
    });

    it("allows two client reschedules, then LIMIT_REACHED", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      expect(await reschedule(id, watDate(6), "10:00 AM", "client")).toMatchObject({ ok: true, result: { client_reschedule_count: 1 } });
      expect(await reschedule(id, watDate(7), "10:00 AM", "client")).toMatchObject({ ok: true, result: { client_reschedule_count: 2 } });
      expect(await reschedule(id, watDate(8), "10:00 AM", "client")).toEqual({ ok: false, code: "LIMIT_REACHED" });
      expect((await bookingRow(id)).client_reschedule_count).toBe(2);
    });

    it("lets the admin bypass both the notice window and the client limit, without bumping the count", async () => {
      await db.exec("update settings set value = '72' where key = 'min_booking_notice_hours'");
      const tooClose = await insertBooking({ date: watDate(2), time: "9:00 AM" });
      expect(await reschedule(tooClose, watDate(1), "4:00 PM", "admin")).toMatchObject({ ok: true });

      const maxed = await insertBooking({ date: watDate(9), time: "10:00 AM", count: 2 });
      expect(await reschedule(maxed, watDate(10), "10:00 AM", "admin")).toMatchObject({ ok: true, result: { client_reschedule_count: 2 } });
      expect((await bookingRow(maxed)).client_reschedule_count).toBe(2);
    });
  });

  describe("reschedule_booking — side effects", () => {
    it("rebuilds reminders for the new time, including ones already sent for the old time", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await db.query(
        `insert into booking_reminders (booking_id, reminder_type, scheduled_for, sent_at)
         values ($1, '24h_before', now() - interval '1 hour', now()), ($1, '2h_before', now() + interval '3 days', null)`,
        [id],
      );
      const out = await reschedule(id, watDate(8), "2:00 PM", "admin");
      expect(out).toMatchObject({ ok: true, result: { reminders_scheduled: 2 } });

      const reminders = await db.query<{ reminder_type: string; sent_at: Date | null; expected: boolean }>(
        `select reminder_type, sent_at,
           scheduled_for = (($2::date + interval '14 hours') at time zone 'Africa/Lagos')
             - case reminder_type when '24h_before' then interval '24 hours' else interval '2 hours' end as expected
         from booking_reminders where booking_id = $1 order by reminder_type`,
        [id, watDate(8)],
      );
      expect(reminders.rows).toEqual([
        { reminder_type: "24h_before", sent_at: null, expected: true },
        { reminder_type: "2h_before", sent_at: null, expected: true },
      ]);
    });

    it("clears reminders without recreating them for a booking that isn't confirmed yet", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM", status: "quoted" });
      await db.query("insert into booking_reminders (booking_id, reminder_type, scheduled_for) values ($1, '24h_before', now() + interval '1 day')", [id]);
      await reschedule(id, watDate(8), "2:00 PM", "client");
      expect((await db.query("select 1 from booking_reminders where booking_id = $1", [id])).rows).toHaveLength(0);
    });

    it("writes an audit row and sets last_rescheduled_at", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await reschedule(id, watDate(6), "3:00 PM", "admin", "  Nessy is travelling  ");
      const audit = await db.query<Record<string, unknown>>(
        "select old_date::text, old_start_time, new_date::text, new_start_time, rescheduled_by, reason from booking_reschedules where booking_id = $1", [id],
      );
      expect(audit.rows).toEqual([{
        old_date: watDate(5), old_start_time: "10:00 AM", new_date: watDate(6), new_start_time: "3:00 PM",
        rescheduled_by: "admin", reason: "Nessy is travelling",
      }]);
      expect((await bookingRow(id)).last_rescheduled_at).not.toBeNull();
    });

    it("writes nothing when the reschedule is rejected", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM", status: "completed" });
      await reschedule(id, watDate(6), "3:00 PM", "admin");
      expect((await db.query("select 1 from booking_reschedules where booking_id = $1", [id])).rows).toHaveLength(0);
      expect((await bookingRow(id)).booking_date).toBe(watDate(5));
    });

    it("returns the old and new values", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      expect(await reschedule(id, watDate(6), "3:00 PM", "client")).toMatchObject({
        ok: true,
        result: { old_date: watDate(5), old_time: "10:00 AM", new_date: watDate(6), new_time: "3:00 PM", rescheduled_by: "client" },
      });
    });
  });

  describe("reschedule_booking — access", () => {
    const fn = "public.reschedule_booking(uuid, date, text, text, text)";

    it("is executable by service_role only", async () => {
      const res = await db.query<{ anon: boolean; auth: boolean; service: boolean }>(
        `select has_function_privilege('anon', '${fn}', 'execute') as anon,
                has_function_privilege('authenticated', '${fn}', 'execute') as auth,
                has_function_privilege('service_role', '${fn}', 'execute') as service`,
      );
      expect(res.rows[0]).toEqual({ anon: false, auth: false, service: true });
    });

    it.runIf(upTo === "022")("keeps the legacy anon reschedule_booking(text, text, date, text) working until 023", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await asAnon(`select reschedule_booking('BK-${legacyRef(id)}', '08161271343', '${watDate(6)}'::date, '2:00 PM')`);
      expect(await bookingRow(id)).toMatchObject({ booking_date: watDate(6), booking_time: "2:00 PM" });
    });

    it.runIf(upTo === "022")("keeps the legacy anon cancel_booking(text, text) working until 023", async () => {
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await asAnon(`select cancel_booking('BK-${legacyRef(id)}', '08161271343')`);
      expect((await bookingRow(id)).status).toBe("cancelled");
    });

    it.runIf(upTo === "023")("drops the old anon-callable reschedule_booking(text, text, date, text)", async () => {
      const res = await db.query("select 1 from pg_proc where proname = 'reschedule_booking' and pronargs = 4");
      expect(res.rows).toHaveLength(0);
    });

    it.runIf(upTo === "023")("revokes anon/authenticated execute on the legacy cancel_booking(text, text)", async () => {
      const res = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', 'public.cancel_booking(text, text)', 'execute') as anon,
                has_function_privilege('authenticated', 'public.cancel_booking(text, text)', 'execute') as auth`,
      );
      expect(res.rows[0]).toEqual({ anon: false, auth: false });
      const id = await insertBooking({ date: watDate(5), time: "10:00 AM" });
      await expect(asAnon(`select cancel_booking('BK-${legacyRef(id)}', '08161271343')`)).rejects.toThrow(/permission denied/);
    });

    it("keeps booking_reschedules unreadable to anon", async () => {
      const res = await db.query<{ anon: boolean }>("select has_table_privilege('anon', 'booking_reschedules', 'select') as anon");
      expect(res.rows[0].anon).toBe(false);
    });

    it("stops an anon insert from seeding its own reschedule count", async () => {
      await db.exec("grant insert on bookings to anon");
      // A positive count passes the >= 0 check constraint, so RLS is the only thing that can stop it.
      const insertAsAnon = (count: number, time: string) => asAnon(
        `insert into bookings (client_name, client_phone, booking_date, booking_time, client_reschedule_count)
         values ('Eve', '08000000000', '${watDate(5)}', '${time}', ${count})`,
      );
      await expect(insertAsAnon(5, "9:00 AM")).rejects.toThrow(/row-level security/);
      // 022 keeps the (tightened) direct-insert path for the live booking form; 023 removes it,
      // leaving create_booking() as the only way in.
      if (upTo === "022") await expect(insertAsAnon(0, "1:00 PM")).resolves.toBeDefined();
      else await expect(insertAsAnon(0, "1:00 PM")).rejects.toThrow(/row-level security/);
    });
  });
});
