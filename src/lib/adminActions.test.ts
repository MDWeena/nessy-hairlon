import { describe, expect, it } from "vitest";
import { bookingTiming, cardActions, listOrderFor } from "./adminActions";
import { sortForList } from "../hooks/usePaginatedOrders";
import type { OrderStatus } from "../types";

// 2026-10-21 10:00 WAT (09:00 UTC).
const NOW = Date.parse("2026-10-21T09:00:00Z");
const at = (date: string, time = "12:00 PM", status: OrderStatus = "confirmed", lastRescheduledAt: string | null = null) =>
  cardActions({ status, date, time, lastRescheduledAt }, NOW);
const menu = (a: ReturnType<typeof cardActions>) => a.menu.map(m => m.label);

describe("bookingTiming (Africa/Lagos)", () => {
  it("knows today, started and due-or-past", () => {
    expect(bookingTiming("2026-10-21", "4:00 PM", NOW)).toEqual({ isToday: true, hasStarted: false, isDueOrPast: true });
    expect(bookingTiming("2026-10-21", "9:00 AM", NOW)).toEqual({ isToday: true, hasStarted: true, isDueOrPast: true });
    expect(bookingTiming("2026-10-22", "10:00 AM", NOW)).toEqual({ isToday: false, hasStarted: false, isDueOrPast: false });
    expect(bookingTiming("2026-10-20", "4:00 PM", NOW)).toEqual({ isToday: false, hasStarted: true, isDueOrPast: true });
  });

  it("uses WAT, not UTC: 23:30 UTC on the 20th is already the 21st in Lagos", () => {
    expect(bookingTiming("2026-10-21", "10:00 AM", Date.parse("2026-10-20T23:30:00Z")).isToday).toBe(true);
  });
});

describe("card action matrix (status × upcoming / today / past)", () => {
  const cases: [OrderStatus, string, string, string | null, string[]][] = [
    // status,          date,         time,       primary,           menu
    ["pending_review", "2026-10-25", "10:00 AM", "set_price",       ["Reschedule"]],
    ["pending_review", "2026-10-19", "10:00 AM", "set_price",       []],
    ["quoted",         "2026-10-25", "10:00 AM", null,              ["Reschedule", "Confirm without deposit"]],
    ["quoted",         "2026-10-19", "10:00 AM", null,              ["Confirm without deposit"]],
    ["deposit_paid",   "2026-10-25", "10:00 AM", "verify_payment",  ["Reschedule"]],
    ["deposit_paid",   "2026-10-19", "10:00 AM", "verify_payment",  []],
    ["confirmed",      "2026-10-25", "10:00 AM", null,              ["Reschedule"]],
    ["confirmed",      "2026-10-21", "4:00 PM",  "mark_completed",  ["Reschedule"]],
    ["confirmed",      "2026-10-21", "9:00 AM",  "mark_completed",  ["Reschedule (missed appointment)"]],
    ["confirmed",      "2026-10-19", "10:00 AM", "mark_completed",  ["Reschedule (missed appointment)"]],
    ["completed",      "2026-10-19", "10:00 AM", null,              ["Move back to Confirmed"]],
    ["completed",      "2026-10-21", "4:00 PM",  null,              ["Move back to Confirmed"]],
    ["cancelled",      "2026-10-25", "10:00 AM", null,              []],
    ["cancelled",      "2026-10-19", "10:00 AM", null,              []],
  ];
  it.each(cases)("%s on %s %s → primary %s, menu %j", (status, date, time, primary, items) => {
    const a = at(date, time, status);
    expect(a.primary).toBe(primary);
    expect(menu(a)).toEqual(items);
  });

  it("completed bookings never get Reschedule or Set Price", () => {
    for (const date of ["2026-10-19", "2026-10-21", "2026-10-30"]) {
      const a = at(date, "10:00 AM", "completed", "2026-10-15T10:00:00Z");
      expect(a.primary).toBeNull();
      expect(a.menu.some(m => m.action === "reschedule")).toBe(false);
    }
  });

  it("adds Reschedule history for any booking that's been rescheduled", () => {
    expect(menu(at("2026-10-25", "10:00 AM", "confirmed", "2026-10-15T10:00:00Z"))).toEqual(["Reschedule", "Reschedule history"]);
    expect(menu(at("2026-10-19", "10:00 AM", "completed", "2026-10-15T10:00:00Z"))).toEqual(["Reschedule history", "Move back to Confirmed"]);
  });
});

describe("list ordering", () => {
  const TODAY = "2026-10-21";
  const row = (id: string, booking_date: string, booking_time: string) => ({ id, booking_date, booking_time });
  const rows = [
    row("past-old", "2026-10-02", "10:00 AM"),
    row("far", "2026-12-01", "10:00 AM"),
    row("today-4pm", TODAY, "4:00 PM"),
    row("past-recent-10am", "2026-10-20", "10:00 AM"),
    row("today-10am", TODAY, "10:00 AM"),
    row("past-recent-4pm", "2026-10-20", "4:00 PM"),
    row("soon-9am", "2026-10-22", "9:00 AM"),
    row("soon-12pm", "2026-10-22", "12:00 PM"),
  ];

  it("upcoming first, soonest at the top (date, then time — 9 AM before 12 PM), then past, most recent first", () => {
    expect(sortForList(rows, "upcoming_first", TODAY).map(r => r.id)).toEqual([
      "today-10am", "today-4pm", "soon-9am", "soon-12pm", "far",
      "past-recent-4pm", "past-recent-10am", "past-old",
    ]);
  });

  it("Completed and Cancelled list most recent first", () => {
    expect(sortForList(rows, "most_recent_first", TODAY).map(r => r.id)).toEqual([
      "far", "soon-12pm", "soon-9am", "today-4pm", "today-10am", "past-recent-4pm", "past-recent-10am", "past-old",
    ]);
  });

  it("picks the order per tab", () => {
    for (const f of ["all", "pending_review", "quoted", "deposit_paid", "confirmed"]) expect(listOrderFor(f)).toBe("upcoming_first");
    for (const f of ["completed", "cancelled"]) expect(listOrderFor(f)).toBe("most_recent_first");
  });
});
