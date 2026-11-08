// @vitest-environment node
import { describe, expect, it } from "vitest";
import { closeMonths, type MonthCloseRepo, type MonthReportRow } from "../_lib/monthClose";
import type { FinanceRows } from "../../src/lib/financeData";

const at = (iso: string) => Date.parse(iso);
// 02:00 WAT on a given Lagos date = 01:00 UTC (the cron's schedule).
const cronRun = (watDate: string) => at(`${watDate}T01:00:00Z`);

function rows(over: { trackingStart?: string | null } = {}): FinanceRows {
  const booking = (id: string, date: string, extra: Record<string, unknown> = {}) => ({
    id, client_name: id, client_phone: "080", client_email: null, booking_date: date, booking_time: "10:00 AM", service_ids: [],
    custom_style_url: null, custom_style_description: null, status: "completed", quoted_price: 30000, notes: null,
    created_at: "2026-10-06T16:35:00Z", updated_at: "2026-10-06T16:35:00Z", deposit_confirmed_at: null, payment_proof_url: null,
    attachment_preference: null, attachment_items: [], accessory_items: [], hair_service_cost: null, balance_paid_at: null,
    balance_reminder_sent_at: null, style_reference_urls: [], client_notes: null, custom_style_category: null, reference_code: id,
    client_reschedule_count: 0, last_rescheduled_at: null, product_cost: 3000, product_cost_note: null, ...extra,
  });
  const start = over.trackingStart === undefined ? "2026-10-06" : over.trackingStart;
  return {
    bookings: [
      booking("oct-a", "2026-10-20"),
      booking("oct-b", "2026-10-22", { product_cost: null }), // product cost not filled in yet
      booking("nov-a", "2026-11-05"),
    ] as never,
    services: [], payments: [], expenses: [], recurring: [],
    rates: [
      { id: "r1", kind: "staff_salary", amount: 30000, effective_from: "2000-01-01", created_at: "" },
      { id: "r2", kind: "transport_daily", amount: 1500, effective_from: "2000-01-01", created_at: "" },
    ],
    config: start ? [{ key: "tracking_start_date", value: start, updated_at: "" }] : [],
    depositPercentage: 50,
  };
}

/** In-memory monthly_reports: insert-if-absent, like the real upsert(ignoreDuplicates). */
function repo(closed: string[] = [], r: FinanceRows = rows()): MonthCloseRepo & { inserted: MonthReportRow[]; closed: string[] } {
  const inserted: MonthReportRow[] = [];
  return {
    inserted, closed,
    load: async () => ({ rows: r, closedMonths: [...closed] }),
    insert: async (row) => {
      const m = row.month.slice(0, 7);
      if (closed.includes(m)) return false;
      inserted.push(row); closed.push(m); return true;
    },
  };
}

describe("month close: automatic, no manual step", () => {
  it("closes the previous month on the 1st (WAT) — 'on schedule'", async () => {
    const r = repo(["2026-10"]);
    const res = await closeMonths(r, cronRun("2026-12-01"), false);
    expect(res.closed).toEqual([expect.objectContaining({ month: "2026-11", reason: "on schedule" })]);
    expect(r.inserted.map(i => i.month)).toEqual(["2026-11-01"]);
    expect(r.inserted[0].insights.length).toBeGreaterThanOrEqual(3);
  });

  it("the 1st in WAT, not UTC: 23:30 UTC on 30 Nov is already 1 Dec in Lagos", async () => {
    const res = await closeMonths(repo(["2026-10"]), at("2026-11-30T23:30:00Z"), false);
    expect(res.closed.map(c => [c.month, c.reason])).toEqual([["2026-11", "on schedule"]]);
  });

  it("catches up after a missed 1st — the next day's run closes it as 'catch-up'", async () => {
    const r = repo(["2026-10"]);
    const res = await closeMonths(r, cronRun("2026-12-02"), false);
    expect(res.closed).toEqual([expect.objectContaining({ month: "2026-11", reason: "catch-up" })]);
  });

  it("catches up several missed months in order", async () => {
    const res = await closeMonths(repo(), cronRun("2026-12-03"), false);
    expect(res.closed.map(c => [c.month, c.reason])).toEqual([["2026-10", "catch-up"], ["2026-11", "catch-up"]]);
  });

  it("does nothing mid-month when nothing is due", async () => {
    const r = repo(["2026-10"]);
    const res = await closeMonths(r, cronRun("2026-11-15"), false);
    expect(res.closed).toEqual([]);
    expect(r.inserted).toEqual([]);
  });

  it("never closes the current month, even on its last evening", async () => {
    const res = await closeMonths(repo(["2026-10"]), at("2026-11-30T22:30:00Z"), false); // 23:30 WAT, 30 Nov
    expect(res.closed).toEqual([]);
  });

  it("never double-closes: a closed month is skipped, and a report written meanwhile is left alone", async () => {
    const r = repo(["2026-10"]);
    await closeMonths(r, cronRun("2026-12-01"), false);
    const again = await closeMonths(r, cronRun("2026-12-02"), false);
    expect(again.closed).toEqual([]);
    expect(r.inserted).toHaveLength(1);
    // Race: another run inserts November between this run's load and insert.
    const racing = repo(["2026-10"]);
    racing.insert = async () => false;
    expect((await closeMonths(racing, cronRun("2026-12-01"), false)).closed).toEqual([]);
  });

  it("waits for the tracking start to be set", async () => {
    const r = repo([], rows({ trackingStart: null }));
    const res = await closeMonths(r, cronRun("2026-11-09"), false);
    expect(res.closed).toEqual([]);
    expect(res.skipped).toMatch(/Tracking start/);
    expect(r.inserted).toEqual([]);
  });

  it("October: the first run after deploy (9 Nov) closes it as a catch-up, recording missing product costs", async () => {
    const r = repo();
    const res = await closeMonths(r, cronRun("2026-11-09"), false);
    expect(res.closed).toEqual([expect.objectContaining({ month: "2026-10", reason: "catch-up", productsMissing: 1 })]);
    expect(r.inserted[0].month).toBe("2026-10-01");
    expect(r.inserted[0].figures).toMatchObject({ earned: 60000, appointments: 2, productsMissing: 1, products: 3000 });
    // …and November isn't touched until it's over.
    expect(r.closed).toEqual(["2026-10"]);
  });

  it("dry run reports what it would close without writing", async () => {
    const r = repo();
    const res = await closeMonths(r, cronRun("2026-11-09"), true);
    expect(res.closed.map(c => c.month)).toEqual(["2026-10"]);
    expect(r.inserted).toEqual([]);
  });
});
