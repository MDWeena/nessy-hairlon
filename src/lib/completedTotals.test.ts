import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeRevenueBreakdown, computeStats, rowToOrder, type BookingRow } from "../hooks/useBookings";
import { scheduledBetween, todaysSchedule } from "./dashboardSchedule";
import { calculateBalanceAmount } from "./payments";
import { getWeekRange, toISODateString } from "./date";

// Fixed "now" inside a week so this-week stats have something to count.
const NOW = new Date("2026-10-21T10:00:00Z");
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

function row(id: string, over: Partial<BookingRow>): BookingRow {
  return {
    id, client_name: `Client ${id}`, client_phone: `080000000${id.length}${id}`, client_email: "c@example.com",
    booking_date: "2026-10-21", booking_time: "10:00 AM", service_ids: [], custom_style_url: null, custom_style_description: null,
    status: "confirmed", quoted_price: 100000, notes: null, deposit_confirmed_at: "2026-10-15T10:00:00Z", payment_proof_url: null,
    created_at: "2026-10-10T10:00:00Z", updated_at: "2026-10-10T10:00:00Z", attachment_preference: null, attachment_items: [],
    accessory_items: [], hair_service_cost: null, balance_paid_at: null, balance_reminder_sent_at: null, style_reference_urls: [],
    client_notes: null, custom_style_category: null, reference_code: id.toUpperCase().padEnd(8, "0").slice(0, 8),
    client_reschedule_count: 0, last_rescheduled_at: null,
    ...over,
  } as BookingRow;
}

const week = getWeekRange(NOW);
const ROWS: BookingRow[] = [
  row("a", { booking_date: toISODateString(NOW) }),                                   // today, deposit only
  row("b", { booking_date: week.start, balance_paid_at: "2026-10-20T10:00:00Z" }),    // fully paid, this week
  row("c", { booking_date: "2026-10-02", balance_paid_at: "2026-10-02T15:00:00Z" }), // last month, fully paid
  row("d", { booking_date: "2026-10-24", deposit_confirmed_at: null, quoted_price: 60000 }), // confirmed without deposit
  row("e", { booking_date: "2026-10-23", attachment_preference: "nessy_buys", hair_service_cost: 50000, quoted_price: 80000,
             attachment_items: [{ type: "Braiding hair", quantity: 3, unit_cost: 10000 }] as BookingRow["attachment_items"] }),
  row("f", { status: "pending_review", quoted_price: null, deposit_confirmed_at: null }),
  row("g", { status: "cancelled", booking_date: "2026-10-22" }),
];

/** Every confirmed booking flipped to completed — what "Mark Completed" does. */
const completedVersion = (rows: BookingRow[]) => rows.map(r => (r.status === "confirmed" ? { ...r, status: "completed" as const } : r));

describe("moving bookings from confirmed → completed changes no totals", () => {
  const nameById = new Map<string, string>();
  const before = ROWS;
  const after = completedVersion(ROWS);

  it("weekly stats (bookings, revenue, deposits, balance, clients)", () => {
    expect(after.filter(r => r.status === "completed").length).toBe(5);
    const stats = computeStats(before, 50);
    expect(stats.revenueThisWeek).toBeGreaterThan(0);
    expect(stats.balanceCollectedThisWeek).toBeGreaterThan(0);
    expect(computeStats(after, 50)).toEqual(stats);
  });

  it("all-time revenue breakdown and material costs", () => {
    const breakdown = computeRevenueBreakdown(before, 50);
    expect(breakdown.totalReceived).toBeGreaterThan(0);
    expect(breakdown.attachmentMaterialCosts).toBeGreaterThan(0);
    expect(computeRevenueBreakdown(after, 50)).toEqual(breakdown);
  });

  it("today's schedule and the upcoming week on the dashboard", () => {
    const today = toISODateString(NOW);
    const ids = (orders: ReturnType<typeof rowToOrder>[]) => orders.map(o => o.id).sort();
    const b = before.map(r => rowToOrder(r, nameById));
    const a = after.map(r => rowToOrder(r, nameById));
    expect(ids(todaysSchedule(a, today))).toEqual(ids(todaysSchedule(b, today)));
    expect(ids(scheduledBetween(a, today, "2026-10-28"))).toEqual(ids(scheduledBetween(b, today, "2026-10-28")));
    expect(ids(todaysSchedule(a, today))).toEqual(["a"]);
  });

  it("balance due per booking (balance tracking and reminders)", () => {
    const balance = (r: BookingRow) => calculateBalanceAmount({
      quotedPrice: r.quoted_price, attachmentPreference: r.attachment_preference,
      attachmentItems: (r.attachment_items ?? []).map(i => ({ quantity: i.quantity, unitCost: i.unit_cost })),
      accessoryItems: [], hairServiceCost: r.hair_service_cost, depositConfirmedAt: r.deposit_confirmed_at,
    }, 50);
    expect(after.map(balance)).toEqual(before.map(balance));
  });
});
