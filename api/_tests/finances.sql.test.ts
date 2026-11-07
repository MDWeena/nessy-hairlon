// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
let grantsBefore: unknown[];
/** Every privilege anon / authenticated hold on tables and views that existed before 024. */
const GRANTS = `select table_name, grantee, privilege_type from information_schema.role_table_grants
  where grantee in ('anon', 'authenticated') and table_schema = 'public'
    and table_name not in ('payments', 'cost_rates', 'expenses', 'recurring_expenses', 'category_product_costs', 'finance_config', 'monthly_reports')
  order by 1, 2, 3`;

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
  grantsBefore = (await db.query(GRANTS)).rows;
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

  it("starts the rates (₦30,000 salary, ₦1,500 per hair day) from the tracking start, and leaves the tracking start to be confirmed", async () => {
    const rates = await db.query<{ kind: string; amount: number; f: string }>("select kind, amount, effective_from::text as f from cost_rates order by kind");
    expect(rates.rows).toEqual([{ kind: "staff_salary", amount: 30000, f: "2000-01-01" }, { kind: "transport_daily", amount: 1500, f: "2000-01-01" }]);
    const start = await db.query("select 1 from finance_config where key = 'tracking_start_date'");
    expect(start.rows).toEqual([]);
  });

  it("leaves anon's (and authenticated's) privileges on every existing table and view exactly as before", async () => {
    expect((await db.query(GRANTS)).rows).toEqual(grantsBefore);
  });
});

describe("security: product_cost and finance data are admin-only", () => {
  const asRole = async <T>(role: "anon" | "authenticated", sql: string) => {
    await db.exec(`set role ${role}`);
    try { return await db.query<T>(sql); } finally { await db.exec("reset role"); }
  };

  it("after 024, anon still reads no bookings rows — so no product cost (RLS, as before 024)", async () => {
    await db.exec("update bookings set product_cost = 4321, product_cost_note = 'secret' where id = '00000000-0000-4000-8000-000000000001'");
    expect((await asRole("anon", "select product_cost, product_cost_note from bookings")).rows).toEqual([]);
    expect((await asRole("anon", "select * from bookings")).rows).toEqual([]);
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

describe("025: anon loses table-level SELECT on bookings; every client path keeps working", () => {
  const asAnon = async <T>(sql: string) => {
    await db.exec("set role anon");
    try { return await db.query<T>(sql); } finally { await db.exec("reset role"); }
  };

  beforeAll(async () => { await applyMigration(db, "025_lock_down_anon_bookings.sql"); });

  it("a direct anon read of bookings is refused outright", async () => {
    await expect(asAnon("select product_cost from bookings")).rejects.toThrow(/permission denied/);
    await expect(asAnon("select * from bookings")).rejects.toThrow(/permission denied/);
    const priv = await db.query<{ a: boolean; b: boolean }>(
      "select has_column_privilege('anon', 'bookings', 'product_cost', 'select') as a, has_column_privilege('anon', 'bookings', 'product_cost_note', 'select') as b");
    expect(priv.rows[0]).toEqual({ a: false, b: false });
  });

  it("keeps anon's other bookings privileges (RLS still denies them) so old clients get the mapped RLS error", async () => {
    const p = await db.query<{ i: boolean }>("select has_table_privilege('anon', 'bookings', 'insert') as i");
    expect(p.rows[0].i).toBe(true);
    await expect(asAnon("insert into bookings (client_name, client_phone, booking_date, booking_time) values ('x', '0800', '2099-01-01', '10:00 AM')")).rejects.toThrow(/row-level security/);
  });

  it("the calendar's taken slots and the booking lookups still work as anon", async () => {
    const slots = await asAnon<{ booking_date: string }>("select booking_date, booking_time, status from public_booking_slots");
    expect(slots.rows.length).toBeGreaterThan(0);
    const lookup = await asAnon<Record<string, unknown>>("select * from lookup_bookings(null, '0801')");
    expect(lookup.rows).toHaveLength(1);
    expect(JSON.stringify(lookup.rows)).not.toMatch(/4321|secret/);
  });

  it("changes nothing else: every other privilege identical to before 024", async () => {
    const after = (await db.query<{ table_name: string; grantee: string; privilege_type: string }>(GRANTS)).rows;
    const removed = (grantsBefore as typeof after).filter(g => !after.some(a => a.table_name === g.table_name && a.grantee === g.grantee && a.privilege_type === g.privilege_type));
    expect(removed).toEqual([{ table_name: "bookings", grantee: "anon", privilege_type: "SELECT" }]);
    expect(after.length).toBe(grantsBefore.length - 1);
  });
});

describe("rollout scripts: 024 applied in one transaction with in-transaction checks", () => {
  const rollout = (f: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "rollout", "finances", f), "utf8");
  const migration = (f: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations", f), "utf8").replace(/create extension if not exists pgcrypto;/i, "");
  const fresh = async () => {
    const d = await createMigratedDb({ upTo: "023" });
    await d.exec(`grant usage on schema public to anon, authenticated, service_role;
      grant select, insert, update, delete on bookings to anon, authenticated; ${SEED}`);
    await d.exec("grant select, insert, update, delete on all tables in schema public to authenticated, anon");
    return d;
  };
  const tableExists = async (d: Awaited<ReturnType<typeof fresh>>, t: string) =>
    (await d.query<{ e: boolean }>(`select to_regclass('public.${t}') is not null as e`)).rows[0].e;

  it("passes and commits on a healthy database", async () => {
    const d = await fresh();
    try {
      await d.exec(rollout("024_pre_checks.sql") + migration("024_finances.sql") + rollout("024_post_checks.sql"));
      expect(await tableExists(d, "payments")).toBe(true);
    } finally { await d.close(); }
  }, 90_000);

  it("aborts and rolls back everything if an existing booking would change", async () => {
    const d = await fresh();
    try {
      const tampered = migration("024_finances.sql") + "\nupdate bookings set notes = 'changed' where id = '00000000-0000-4000-8000-000000000001';\n";
      await expect(d.exec(rollout("024_pre_checks.sql") + tampered + rollout("024_post_checks.sql"))).rejects.toThrow(/CHECK FAILED: bookings fingerprint changed/);
      await d.exec("rollback");
      expect(await tableExists(d, "payments")).toBe(false);
      expect((await d.query<{ n: string }>("select notes as n from bookings where id = '00000000-0000-4000-8000-000000000001'")).rows[0].n).not.toBe("changed");
    } finally { await d.close(); }
  }, 90_000);

  it("aborts if a permission on an existing object would change", async () => {
    const d = await fresh();
    try {
      const tampered = migration("024_finances.sql") + "\nrevoke select on bookings from anon;\n";
      await expect(d.exec(rollout("024_pre_checks.sql") + tampered + rollout("024_post_checks.sql"))).rejects.toThrow(/CHECK FAILED: 1 privilege/);
      await d.exec("rollback");
      expect(await tableExists(d, "payments")).toBe(false);
    } finally { await d.close(); }
  }, 90_000);
});
