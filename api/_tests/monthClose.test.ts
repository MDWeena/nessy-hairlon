// @vitest-environment node
import { describe, expect, it } from "vitest";
import { closeMonths, type MonthCloseRepo, type MonthReportRow } from "../_lib/monthClose";
import type { FinanceRows } from "../../src/lib/financeData";

function rows(): FinanceRows {
  const booking = (id: string, date: string, over: Record<string, unknown> = {}) => ({
    id, client_name: id, client_phone: "080", client_email: null, booking_date: date, booking_time: "10:00 AM", service_ids: [],
    custom_style_url: null, custom_style_description: null, status: "completed", quoted_price: 30000, notes: null,
    created_at: "2026-10-14T09:00:00Z", updated_at: "2026-10-14T09:00:00Z", deposit_confirmed_at: null, payment_proof_url: null,
    attachment_preference: null, attachment_items: [], accessory_items: [], hair_service_cost: null, balance_paid_at: null,
    balance_reminder_sent_at: null, style_reference_urls: [], client_notes: null, custom_style_category: null, reference_code: id,
    client_reschedule_count: 0, last_rescheduled_at: null, product_cost: 3000, product_cost_note: null, ...over,
  });
  return {
    bookings: [booking("a", "2026-10-20"), booking("b", "2026-11-05")] as never,
    services: [], payments: [], expenses: [], recurring: [],
    rates: [
      { id: "r1", kind: "staff_salary", amount: 30000, effective_from: "2000-01-01", created_at: "" },
      { id: "r2", kind: "transport_daily", amount: 1500, effective_from: "2000-01-01", created_at: "" },
    ],
    config: [{ key: "tracking_start_date", value: "2026-10-14", updated_at: "" }],
    depositPercentage: 50,
  };
}

function repo(closed: string[] = []): MonthCloseRepo & { inserted: MonthReportRow[] } {
  const inserted: MonthReportRow[] = [];
  return {
    inserted,
    load: async () => ({ rows: rows(), closedMonths: closed }),
    insert: async (r) => { if (closed.includes(r.month.slice(0, 7))) return false; inserted.push(r); closed.push(r.month.slice(0, 7)); return true; },
  };
}

describe("month close", () => {
  it("on 1 Nov (WAT) closes October with a snapshot and insights", async () => {
    const r = repo();
    const res = await closeMonths(r, Date.parse("2026-11-01T01:00:00Z"), false);
    expect(res.closed.map(c => c.month)).toEqual(["2026-10"]);
    expect(r.inserted[0].month).toBe("2026-10-01");
    expect(r.inserted[0].figures).toMatchObject({ earned: 30000, appointments: 1, workingDays: 1 });
    expect(r.inserted[0].insights.length).toBeGreaterThanOrEqual(3);
  });

  it("does nothing before the month is over (31 Oct 23:30 WAT)", async () => {
    const r = repo();
    expect((await closeMonths(r, Date.parse("2026-10-31T22:30:00Z"), false)).closed).toEqual([]);
  });

  it("is idempotent and never overwrites a closed report", async () => {
    const r = repo(["2026-10"]);
    expect((await closeMonths(r, Date.parse("2026-11-02T01:00:00Z"), false)).closed).toEqual([]);
    expect(r.inserted).toEqual([]);
  });

  it("catches up after missed runs", async () => {
    const r = repo();
    const res = await closeMonths(r, Date.parse("2026-12-03T01:00:00Z"), false);
    expect(res.closed.map(c => c.month)).toEqual(["2026-10", "2026-11"]);
  });

  it("dry run reports without writing", async () => {
    const r = repo();
    const res = await closeMonths(r, Date.parse("2026-11-01T01:00:00Z"), true);
    expect(res.closed.map(c => c.month)).toEqual(["2026-10"]);
    expect(r.inserted).toEqual([]);
  });
});

describe("month close before the tracking start is chosen", () => {
  it("closes nothing and says why", async () => {
    const r = repo();
    const load = r.load;
    r.load = async () => { const x = await load(); return { ...x, rows: { ...x.rows, config: [] } }; };
    const res = await closeMonths(r, Date.parse("2026-11-01T01:00:00Z"), false);
    expect(res.closed).toEqual([]);
    expect(res.skipped).toMatch(/Tracking start/);
    expect(r.inserted).toEqual([]);
  });
});

describe("month_close_auto_from: months before it wait for the admin", () => {
  const withAutoFrom = (from: string) => {
    const r = repo();
    const load = r.load;
    r.load = async () => { const x = await load(); return { ...x, rows: { ...x.rows, config: [...x.rows.config, { key: "month_close_auto_from", value: from, updated_at: "" }] } }; };
    return r;
  };

  it("on 9 Nov with auto-close from November: October is held back, nothing written", async () => {
    const r = withAutoFrom("2026-11");
    const res = await closeMonths(r, Date.parse("2026-11-09T01:00:00Z"), false);
    expect(res.closed).toEqual([]);
    expect(res.heldBack).toEqual(["2026-10"]);
    expect(r.inserted).toEqual([]);
  });

  it("on 1 Dec it closes November but still not October", async () => {
    const r = withAutoFrom("2026-11");
    const res = await closeMonths(r, Date.parse("2026-12-01T01:00:00Z"), false);
    expect(res.closed.map(c => c.month)).toEqual(["2026-11"]);
    expect(res.heldBack).toEqual(["2026-10"]);
  });

  it("once the admin has closed October, it's simply already closed", async () => {
    const r = withAutoFrom("2026-11");
    r.load = (orig => async () => { const x = await orig(); return { ...x, closedMonths: ["2026-10"] }; })(r.load);
    const res = await closeMonths(r, Date.parse("2026-12-01T01:00:00Z"), false);
    expect(res.closed.map(c => c.month)).toEqual(["2026-11"]);
    expect(res.heldBack).toEqual([]);
  });

  it("moving the setting back makes the next run catch October up", async () => {
    const r = withAutoFrom("2026-10");
    const res = await closeMonths(r, Date.parse("2026-11-09T01:00:00Z"), false);
    expect(res.closed.map(c => c.month)).toEqual(["2026-10"]);
    expect(res.heldBack).toEqual([]);
  });
});
