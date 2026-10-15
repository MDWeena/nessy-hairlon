// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { createMigratedDb, watDate } from "./testDb";

let db: PGlite;

async function insertBooking(date: string, time: string, status = "confirmed"): Promise<string> {
  const res = await db.query<{ id: string }>(
    `insert into bookings (client_name, client_phone, client_email, booking_date, booking_time, status)
     values ('Ada', '08161271343', 'ada@example.com', $1, $2, $3) returning id`,
    [date, time, status],
  );
  return res.rows[0].id;
}

interface CreateArgs {
  date: string;
  time: string;
  name?: string;
  phone?: string;
  styleUrls?: string[];
}

const CREATE_SQL = `select create_booking(
  p_client_name => $1, p_client_phone => $2, p_client_email => 'eve@example.com',
  p_booking_date => $3::date, p_booking_time => $4, p_style_reference_urls => $5::jsonb) as id`;

function createParams({ date, time, name = "Eve", phone = "08000000000", styleUrls = [] }: CreateArgs) {
  return [name, phone, date, time, JSON.stringify(styleUrls)];
}

type CreateOutcome = { ok: true; id: string } | { ok: false; code: string };

async function create(args: CreateArgs, conn: PGlite | Transaction = db): Promise<CreateOutcome> {
  try {
    const res = await conn.query<{ id: string }>(CREATE_SQL, createParams(args));
    return { ok: true, id: res.rows[0].id };
  } catch (err) {
    const e = err as { code?: string; message: string };
    return { ok: false, code: e.code === "P0001" ? e.message : e.code ?? e.message };
  }
}

/** The advisory lock the booking functions take for `date`, as it appears in pg_locks
 * (a bigint key is split into classid = high 32 bits, objid = low 32 bits, objsubid = 1). */
async function holdsDateLock(tx: Transaction, date: string): Promise<boolean> {
  const res = await tx.query<{ held: boolean }>(
    `select exists (
       select 1 from pg_locks l,
         (select hashtext('booking_slot:' || $1)::bigint as k) key
       where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.granted and l.objsubid = 1
         and l.classid = ((key.k >> 32) & 4294967295)::oid and l.objid = (key.k & 4294967295)::oid
     ) as held`,
    [date],
  );
  return res.rows[0].held;
}

// Both phases: create_booking and cancel_booking_by_id arrive in 022 and must behave the same
// once 023 has removed the legacy paths.
describe.each(["022", "023"])("with migrations up to %s", (upTo) => {
  beforeAll(async () => {
    db = await createMigratedDb({ upTo });
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.exec(`
      delete from bookings;
      delete from blocked_slots;
      update schedule_defaults set is_open = true, start_hour = 9, end_hour = 17, max_slots_per_day = 3, min_gap_hours = 3;
      update settings set value = '24' where key = 'min_booking_notice_hours';
    `);
  });

  describe("create_booking", () => {
    it("creates a pending_review booking with every admin/system column at its default", async () => {
      const outcome = await create({ date: watDate(5), time: "10:00 AM" });
      expect(outcome.ok).toBe(true);
      const res = await db.query(
        `select status, quoted_price, notes, client_reschedule_count, last_rescheduled_at, reference_code, client_email
         from bookings where id = $1`, [(outcome as { id: string }).id],
      );
      expect(res.rows[0]).toMatchObject({
        status: "pending_review", quoted_price: null, notes: null, client_reschedule_count: 0,
        last_rescheduled_at: null, client_email: "eve@example.com",
      });
      expect((res.rows[0] as { reference_code: string }).reference_code).toMatch(/^[0-9A-F]{8}$/);
    });

    it("rejects an exactly-taken slot, a slot inside another booking's gap, and a full day", async () => {
      await insertBooking(watDate(5), "10:00 AM");
      expect(await create({ date: watDate(5), time: "10:00 AM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await create({ date: watDate(5), time: "12:00 PM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });

      await db.exec("update schedule_defaults set max_slots_per_day = 2");
      await insertBooking(watDate(5), "2:00 PM");
      expect(await create({ date: watDate(5), time: "5:00 PM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });

    it("ignores cancelled bookings, like the calendar", async () => {
      await insertBooking(watDate(5), "10:00 AM", "cancelled");
      expect((await create({ date: watDate(5), time: "10:00 AM" })).ok).toBe(true);
    });

    it("rejects whole-day and single-hour blocks, closed days and hours outside opening times", async () => {
      await db.exec(`insert into blocked_slots (date, hour) values ('${watDate(5)}', null), ('${watDate(6)}', 11)`);
      expect(await create({ date: watDate(5), time: "2:00 PM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await create({ date: watDate(6), time: "11:00 AM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect((await create({ date: watDate(6), time: "3:00 PM" })).ok).toBe(true);

      expect(await create({ date: watDate(7), time: "8:00 AM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await create({ date: watDate(7), time: "6:00 PM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      await db.exec("update schedule_defaults set is_open = false");
      expect(await create({ date: watDate(7), time: "10:00 AM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });

    it("enforces the notice window and the 14-day window", async () => {
      await db.exec("update settings set value = '72' where key = 'min_booking_notice_hours'");
      expect(await create({ date: watDate(2), time: "10:00 AM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect((await create({ date: watDate(4), time: "10:00 AM" })).ok).toBe(true);
      expect((await create({ date: watDate(13), time: "10:00 AM" })).ok).toBe(true);
      expect(await create({ date: watDate(14), time: "10:00 AM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
    });

    it("rejects a malformed time, a past date, and a missing name or phone", async () => {
      expect(await create({ date: watDate(5), time: "10:30 AM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await create({ date: watDate(-1), time: "10:00 AM" })).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      expect(await create({ date: watDate(5), time: "10:00 AM", name: "  " })).toEqual({ ok: false, code: "INVALID_REQUEST" });
      expect(await create({ date: watDate(5), time: "10:00 AM", phone: "" })).toEqual({ ok: false, code: "INVALID_REQUEST" });
    });

    it("still enforces the trusted style-reference domains (23514)", async () => {
      expect(await create({ date: watDate(5), time: "10:00 AM", styleUrls: ["https://evil.example.com/x"] }))
        .toEqual({ ok: false, code: "23514" });
      expect((await create({ date: watDate(5), time: "10:00 AM", styleUrls: ["https://www.instagram.com/p/abc"] })).ok).toBe(true);
    });

    it("keeps the unique (date, time) index as the last guard, even when the gap rule allows it", async () => {
      // With no minimum gap and room in the day, only the index from 015 stops a duplicate slot.
      await db.exec("update schedule_defaults set min_gap_hours = 0");
      expect((await create({ date: watDate(5), time: "10:00 AM" })).ok).toBe(true);
      expect(await create({ date: watDate(5), time: "10:00 AM" })).toEqual({ ok: false, code: "23505" });
    });

    it("gives the last free slot of a day to exactly one of two back-to-back requests", async () => {
      await db.exec("update schedule_defaults set max_slots_per_day = 2");
      await insertBooking(watDate(5), "9:00 AM");
      const first = await create({ date: watDate(5), time: "1:00 PM" });
      const second = await create({ date: watDate(5), time: "5:00 PM", name: "Zed" });
      expect(first.ok).toBe(true);
      expect(second).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" });
      const count = await db.query<{ n: number }>(`select count(*)::int as n from bookings where booking_date = '${watDate(5)}'`);
      expect(count.rows[0].n).toBe(2);
    });

    it("and a reschedule can't take a slot a new booking just filled (they share the rules)", async () => {
      await db.exec("update schedule_defaults set max_slots_per_day = 2");
      await insertBooking(watDate(5), "9:00 AM");
      const mover = await insertBooking(watDate(6), "10:00 AM");
      expect((await create({ date: watDate(5), time: "1:00 PM" })).ok).toBe(true);
      await expect(db.query("select reschedule_booking($1, $2::date, '5:00 PM', 'admin')", [mover, watDate(5)]))
        .rejects.toThrow("SLOT_UNAVAILABLE");
    });

    // PGlite is a single connection, so two genuinely simultaneous transactions can't be run
    // here. What makes them safe on real Postgres is that both functions take the same
    // transaction-scoped advisory lock on the date BEFORE reading availability — so the second
    // caller blocks until the first commits, then sees its booking. These pin that down.
    it("holds the per-date advisory lock for the rest of the transaction", async () => {
      await db.transaction(async (tx) => {
        expect(await holdsDateLock(tx, watDate(5))).toBe(false);
        expect((await create({ date: watDate(5), time: "10:00 AM" }, tx)).ok).toBe(true);
        expect(await holdsDateLock(tx, watDate(5))).toBe(true);
        expect(await holdsDateLock(tx, watDate(6))).toBe(false);
      });
    });

    it("uses the same lock key as reschedule_booking", async () => {
      const id = await insertBooking(watDate(6), "10:00 AM");
      await db.transaction(async (tx) => {
        await tx.query("select reschedule_booking($1, $2::date, '2:00 PM', 'admin')", [id, watDate(5)]);
        expect(await holdsDateLock(tx, watDate(5))).toBe(true);
      });
    });

    it("is executable by anon and authenticated, and works for anon even with RLS on", async () => {
      const res = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', 'public.create_booking(text, text, text, date, text, uuid[], text, text, jsonb, text, text)', 'execute') as anon,
                has_function_privilege('authenticated', 'public.create_booking(text, text, text, date, text, uuid[], text, text, jsonb, text, text)', 'execute') as auth`,
      );
      expect(res.rows[0]).toEqual({ anon: true, auth: true });
      await db.exec("set role anon");
      try {
        expect((await create({ date: watDate(5), time: "10:00 AM" })).ok).toBe(true);
      } finally {
        await db.exec("reset role");
      }
    });

    it("keeps the internal helpers off the public API", async () => {
      const res = await db.query<{ lock: boolean; check: boolean }>(
        `select has_function_privilege('anon', 'public.lock_booking_date(date)', 'execute') as lock,
                has_function_privilege('anon', 'public.assert_slot_available(date, integer, uuid, boolean)', 'execute') as check`,
      );
      expect(res.rows[0]).toEqual({ lock: false, check: false });
    });
  });

  describe("cancel_booking_by_id", () => {
    async function cancel(id: string): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; code: string }> {
      try {
        const res = await db.query<{ r: Record<string, unknown> }>("select cancel_booking_by_id($1) as r", [id]);
        return { ok: true, result: res.rows[0].r };
      } catch (err) {
        return { ok: false, code: (err as Error).message };
      }
    }

    it("cancels any active status and returns what it was", async () => {
      for (const [i, status] of ["pending_review", "quoted", "deposit_paid", "confirmed"].entries()) {
        const id = await insertBooking(watDate(5 + i), "10:00 AM", status);
        expect(await cancel(id)).toMatchObject({ ok: true, result: { previous_status: status, date: watDate(5 + i), time: "10:00 AM" } });
        const row = await db.query<{ status: string }>("select status from bookings where id = $1", [id]);
        expect(row.rows[0].status).toBe("cancelled");
      }
    });

    it("refuses completed and cancelled bookings, and unknown ids", async () => {
      expect(await cancel(await insertBooking(watDate(5), "10:00 AM", "completed"))).toEqual({ ok: false, code: "INVALID_STATUS" });
      expect(await cancel(await insertBooking(watDate(6), "10:00 AM", "cancelled"))).toEqual({ ok: false, code: "INVALID_STATUS" });
      expect(await cancel("00000000-0000-0000-0000-000000000000")).toEqual({ ok: false, code: "NOT_FOUND" });
    });

    it("drops unsent reminders but keeps the record of sent ones", async () => {
      const id = await insertBooking(watDate(5), "10:00 AM");
      await db.query(
        `insert into booking_reminders (booking_id, reminder_type, scheduled_for, sent_at)
         values ($1, '24h_before', now() + interval '1 day', null), ($1, '2h_before', now() - interval '1 hour', now())`, [id],
      );
      await cancel(id);
      const res = await db.query<{ reminder_type: string }>("select reminder_type from booking_reminders where booking_id = $1", [id]);
      expect(res.rows.map(r => r.reminder_type)).toEqual(["2h_before"]);
    });

    it("frees the slot for a new booking", async () => {
      const id = await insertBooking(watDate(5), "10:00 AM");
      await cancel(id);
      expect((await create({ date: watDate(5), time: "10:00 AM" })).ok).toBe(true);
    });

    it("is executable by service_role only", async () => {
      const res = await db.query<{ anon: boolean; auth: boolean; service: boolean }>(
        `select has_function_privilege('anon', 'public.cancel_booking_by_id(uuid)', 'execute') as anon,
                has_function_privilege('authenticated', 'public.cancel_booking_by_id(uuid)', 'execute') as auth,
                has_function_privilege('service_role', 'public.cancel_booking_by_id(uuid)', 'execute') as service`,
      );
      expect(res.rows[0]).toEqual({ anon: false, auth: false, service: true });
    });
  });
});
