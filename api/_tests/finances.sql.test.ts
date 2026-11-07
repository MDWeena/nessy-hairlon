// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { applyMigration, createMigratedDb, watDate } from "./testDb";
import { calculateBalanceAmount, calculateDepositAmount } from "../../src/lib/payments";

let db: PGlite;

/** Varied existing bookings, as production has before 024: every formula path + rounding. */
const SEED = `
  update settings set value = '50' where key = 'deposit_percentage';
  insert into bookings (id, client_name, client_phone, booking_date, booking_time, status, quoted_price, deposit_confirmed_at, balance_paid_at,
                        attachment_preference, hair_service_cost, attachment_items, accessory_items, created_at) values
    ('00000000-0000-4000-8000-000000000001', 'Pct deposit only',   '0801', '${watDate(-20)}', '10:00 AM', 'confirmed', 45000, '2026-10-01T10:00:00Z', null, null, null, '[]', '[]', '2026-10-14T09:00:00Z'),
    ('00000000-0000-4000-8000-000000000002', 'Pct fully paid',     '0802', '${watDate(-19)}', '10:00 AM', 'completed', 30001, '2026-10-02T10:00:00Z', '2026-10-05T10:00:00Z', null, null, '[]', '[]', '2026-10-15T09:00:00Z'),
    ('00000000-0000-4000-8000-000000000003', 'Nessy buys',         '0803', '${watDate(-18)}', '10:00 AM', 'completed', 80000, '2026-10-03T10:00:00Z', '2026-10-06T10:00:00Z', 'nessy_buys', 50001,
      '[{"type":"Hair","quantity":3,"unit_cost":10000}]', '[{"type":"Clips","quantity":2,"unit_cost":1500}]', '2026-10-16T09:00:00Z'),
    ('00000000-0000-4000-8000-000000000004', 'Deposit > quote',    '0804', '${watDate(-17)}', '10:00 AM', 'completed', 20000, '2026-10-04T10:00:00Z', '2026-10-07T10:00:00Z', 'nessy_buys', 10000,
      '[{"type":"Hair","quantity":4,"unit_cost":10000}]', '[]', '2026-10-17T09:00:00Z'),
    ('00000000-0000-4000-8000-000000000005', 'Paid without deposit','0805', '${watDate(-16)}', '10:00 AM', 'completed', 25000, null, '2026-10-08T10:00:00Z', null, null, '[]', '[]', '2026-10-18T09:00:00Z'),
    ('00000000-0000-4000-8000-000000000006', 'Cancelled, kept',    '0806', '${watDate(-15)}', '10:00 AM', 'cancelled', 40000, '2026-10-09T10:00:00Z', null, null, null, '[]', '[]', '2026-10-19T09:00:00Z'),
    ('00000000-0000-4000-8000-000000000007', 'Nothing paid',       '0807', '${watDate(5)}',   '10:00 AM', 'quoted',    35000, null, null, null, null, '[]', '[]', '2026-10-20T09:00:00Z'),
    ('00000000-0000-4000-8000-000000000008', 'No price yet',       '0808', '${watDate(6)}',   '10:00 AM', 'pending_review', null, null, null, null, null, '[]', '[]', '2026-10-21T09:00:00Z');
`;

const FINGERPRINT = `select id::text, md5(row_to_json(b)::text) as h from (select * from bookings) b order by id`;

let before: { id: string; h: string }[];

beforeAll(async () => {
  db = await createMigratedDb({ upTo: "023" });
  // What Supabase grants by default (PGlite has no default grants): table privileges for anon /
  // authenticated, with RLS deciding rows.
  await db.exec(`
    grant usage on schema public to anon, authenticated, service_role;
    grant select, insert, update, delete on bookings to anon, authenticated;
    ${SEED}
  `);
  before = (await db.query<{ id: string; h: string }>(FINGERPRINT)).rows;
  await db.exec("grant select, insert, update, delete on all tables in schema public to authenticated, anon");
  await applyMigration(db, "024_finances.sql");
}, 90_000);

afterAll(async () => { await db.close(); });

describe("024 on a database with existing bookings", () => {
  it("changes no existing booking (every column of every row identical; new columns NULL)", async () => {
    const after = (await db.query<{ id: string; h: string }>(
      `select id::text, md5(row_to_json(b)::text) as h from (select ${(await db.query<{ c: string }>(
        "select string_agg(quote_ident(column_name), ', ' order by ordinal_position) as c from information_schema.columns where table_name = 'bookings' and column_name not in ('product_cost', 'product_cost_note')",
      )).rows[0].c} from bookings) b order by id`,
    )).rows;
    expect(after).toEqual(before);
    const nulls = await db.query<{ n: number }>("select count(*)::int as n from bookings where product_cost is not null or product_cost_note is not null");
    expect(nulls.rows[0].n).toBe(0);
  });

  it("backfills the ledger with exactly what src/lib/payments.ts computes", async () => {
    const rows = (await db.query<Record<string, unknown>>(`
      select id::text, quoted_price, attachment_preference, hair_service_cost, attachment_items, accessory_items, deposit_confirmed_at, balance_paid_at
      from bookings order by id`)).rows;
    const expected: string[] = [];
    for (const r of rows) {
      const items = (x: unknown) => (x as { quantity: number; unit_cost: number }[]).map(i => ({ quantity: i.quantity, unitCost: i.unit_cost }));
      const input = {
        quotedPrice: r.quoted_price as number | null, attachmentPreference: r.attachment_preference as "nessy_buys" | null,
        attachmentItems: items(r.attachment_items), accessoryItems: items(r.accessory_items), hairServiceCost: r.hair_service_cost === null ? null : Number(r.hair_service_cost),
      };
      if (r.deposit_confirmed_at) {
        const d = calculateDepositAmount(input, 50);
        if (d) expected.push(`${r.id}|deposit|${d}`);
      }
      if (r.balance_paid_at) {
        const b = calculateBalanceAmount({ ...input, depositConfirmedAt: r.deposit_confirmed_at ? String(r.deposit_confirmed_at) : null }, 50);
        if (b) expected.push(`${r.id}|balance|${b}`);
      }
    }
    const actual = (await db.query<{ k: string }>("select booking_id::text || '|' || kind || '|' || amount as k from payments order by booking_id, kind")).rows.map(r => r.k);
    expect(actual.sort()).toEqual(expected.sort());
    expect(actual).toContain("00000000-0000-4000-8000-000000000002|deposit|15001"); // 15000.5 rounds up, like Math.round
    expect(actual).toContain("00000000-0000-4000-8000-000000000003|deposit|58001"); // 33,000 materials + half of 50,001
    expect(actual).toContain("00000000-0000-4000-8000-000000000004|deposit|45000"); // 40,000 materials + half of 10,000
    expect(actual.some(k => k.startsWith("00000000-0000-4000-8000-000000000004|balance"))).toBe(false); // floored to 0 → no row
    expect(actual).toContain("00000000-0000-4000-8000-000000000005|balance|25000");
  });

  it("marks backfilled rows and uses the original timestamps", async () => {
    const r = await db.query<{ source: string; received_at: Date }>("select source, received_at from payments where booking_id = '00000000-0000-4000-8000-000000000001'");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].source).toBe("backfill");
    expect(r.rows[0].received_at.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  it("is idempotent: applying it again inserts nothing new", async () => {
    const n = async () => (await db.query<{ n: number }>("select (select count(*) from payments) + (select count(*) from cost_rates) + (select count(*) from finance_config) as n")).rows[0].n;
    const first = await n();
    await applyMigration(db, "024_finances.sql");
    expect(await n()).toBe(first);
  });

  it("starts the rates and tracking start date", async () => {
    const rates = await db.query<{ kind: string; amount: number }>("select kind, amount from cost_rates order by kind");
    expect(rates.rows).toEqual([{ kind: "staff_salary", amount: 50000 }, { kind: "transport_daily", amount: 1500 }]);
    const start = await db.query<{ v: string }>("select value #>> '{}' as v from finance_config where key = 'tracking_start_date'");
    expect(start.rows[0].v).toBe("2026-10-14");
  });
});

describe("security: product_cost and finance data are admin-only", () => {
  const asRole = async <T>(role: "anon" | "authenticated", sql: string) => {
    await db.exec(`set role ${role}`);
    try { return await db.query<T>(sql); } finally { await db.exec("reset role"); }
  };

  it("anon can't select product_cost (or anything) from bookings", async () => {
    await db.exec("update bookings set product_cost = 4321, product_cost_note = 'secret' where id = '00000000-0000-4000-8000-000000000001'");
    await expect(asRole("anon", "select product_cost from bookings")).rejects.toThrow(/permission denied/);
    await expect(asRole("anon", "select * from bookings")).rejects.toThrow(/permission denied/);
    const priv = await db.query<{ a: boolean; b: boolean }>(
      "select has_column_privilege('anon', 'bookings', 'product_cost', 'select') as a, has_column_privilege('anon', 'bookings', 'product_cost_note', 'select') as b");
    expect(priv.rows[0]).toEqual({ a: false, b: false });
  });

  it("no anon access to any new table", async () => {
    for (const t of ["payments", "cost_rates", "expenses", "recurring_expenses", "category_product_costs", "finance_config", "monthly_reports"]) {
      await expect(asRole("anon", `select * from ${t}`), t).rejects.toThrow(/permission denied/);
      const rls = await db.query<{ r: boolean }>(`select relrowsecurity as r from pg_class where relname = '${t}'`);
      expect(rls.rows[0].r, t).toBe(true);
    }
  });

  it("the signed-in admin can read and write them", async () => {
    await asRole("authenticated", `insert into expenses (expense_date, category, amount) values ('2026-11-02', 'Data & phone', 5000)`);
    const r = await asRole<{ n: number }>("authenticated", "select count(*)::int as n from expenses");
    expect(r.rows[0].n).toBe(1);
    const pc = await asRole<{ product_cost: number }>("authenticated", "select product_cost from bookings where id = '00000000-0000-4000-8000-000000000001'");
    expect(pc.rows[0].product_cost).toBe(4321);
  });

  it("client-facing database functions and views never return product cost", async () => {
    const lookup = await asRole<Record<string, unknown>>("anon", "select * from lookup_bookings('BK-00000000', null)");
    const lookupByPhone = await asRole<Record<string, unknown>>("anon", "select * from lookup_bookings(null, '0801')");
    expect(lookupByPhone.rows).toHaveLength(1);
    for (const row of [...lookup.rows, ...lookupByPhone.rows]) {
      expect(Object.keys(row)).not.toContain("product_cost");
      expect(JSON.stringify(row)).not.toMatch(/4321|secret/);
    }
    const slots = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'public_booking_slots'");
    expect(slots.rows.map(r => r.column_name).sort()).toEqual(["booking_date", "booking_time", "status"]);
  });

  it("the ledger allows one deposit and one balance per booking", async () => {
    await expect(db.exec("insert into payments (booking_id, kind, amount) values ('00000000-0000-4000-8000-000000000001', 'deposit', 1)")).rejects.toThrow(/payments_one_per_kind/);
  });
});
