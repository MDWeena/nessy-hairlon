import { describe, expect, it } from "vitest";
import { computeAvailability, toBookingDays, type ComputeAvailabilityInput, type ScheduleDefaultRow } from "./availability";

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const openEveryDay: ScheduleDefaultRow[] = DAY_KEYS.map(day_key => ({
  day_key, is_open: true, start_hour: 9, end_hour: 17, max_slots_per_day: 3, min_gap_hours: 3,
}));

// Midnight on a fixed date, so "now" is well before every slot that day.
const today = new Date(2026, 9, 20, 0, 0, 0, 0);
const DAY0 = "2026-10-20";

function input(overrides: Partial<ComputeAvailabilityInput> = {}): ComputeAvailabilityInput {
  return { today, now: today.getTime(), daysAhead: 3, noticeHours: 0, schedule: openEveryDay, blocked: [], bookings: [], ...overrides };
}

function slotsFor(days: ReturnType<typeof toBookingDays>, date: string) {
  return days.find(d => d.date === date)?.slots ?? [];
}

describe("computeAvailability — excluding the booking being rescheduled", () => {
  it("counts a booking against its own slot and gap zone when not excluded", () => {
    const days = toBookingDays(computeAvailability(input({ bookings: [{ booking_date: DAY0, booking_time: "10:00 AM" }] })));
    expect(slotsFor(days, DAY0)).not.toContain("10:00 AM");
    expect(slotsFor(days, DAY0)).not.toContain("11:00 AM");
  });

  it("frees its own slot and gap zone when excluded, so same-day moves are possible", () => {
    const days = toBookingDays(computeAvailability(input({
      bookings: [{ booking_date: DAY0, booking_time: "10:00 AM" }],
      exclude: { date: DAY0, time: "10:00 AM" },
    })));
    expect(slotsFor(days, DAY0)).toEqual(expect.arrayContaining(["10:00 AM", "11:00 AM", "12:00 PM"]));
  });

  it("doesn't count it against a full day's capacity", () => {
    const oneSlot = openEveryDay.map(s => ({ ...s, max_slots_per_day: 1 }));
    const bookings = [{ booking_date: DAY0, booking_time: "10:00 AM" }];
    expect(slotsFor(toBookingDays(computeAvailability(input({ schedule: oneSlot, bookings }))), DAY0)).toEqual([]);
    expect(slotsFor(toBookingDays(computeAvailability(input({ schedule: oneSlot, bookings, exclude: { date: DAY0, time: "10:00 AM" } }))), DAY0))
      .toContain("3:00 PM");
  });

  it("still respects every OTHER booking", () => {
    const days = toBookingDays(computeAvailability(input({
      bookings: [{ booking_date: DAY0, booking_time: "10:00 AM" }, { booking_date: DAY0, booking_time: "3:00 PM" }],
      exclude: { date: DAY0, time: "10:00 AM" },
    })));
    expect(slotsFor(days, DAY0)).not.toContain("3:00 PM");
    expect(slotsFor(days, DAY0)).not.toContain("1:00 PM");
    expect(slotsFor(days, DAY0)).toContain("12:00 PM");
  });
});

describe("computeAvailability — blocked days, notice", () => {
  it("drops a whole-day block and a single blocked hour", () => {
    const days = toBookingDays(computeAvailability(input({ blocked: [{ date: DAY0, hour: null }, { date: "2026-10-21", hour: 14 }] })));
    expect(days.find(d => d.date === DAY0)).toBeUndefined();
    expect(slotsFor(days, "2026-10-21")).not.toContain("2:00 PM");
  });

  it("hides slots inside the notice window, unless ignoreNotice is set (admin)", () => {
    const morning = new Date(2026, 9, 20, 9, 30).getTime();
    const client = toBookingDays(computeAvailability(input({ now: morning, noticeHours: 24 })));
    const admin = toBookingDays(computeAvailability(input({ now: morning, noticeHours: 24, ignoreNotice: true })));
    expect(slotsFor(client, DAY0)).toEqual([]);
    expect(slotsFor(admin, DAY0)).toContain("10:00 AM");
    expect(slotsFor(admin, DAY0)).not.toContain("9:00 AM"); // already past
  });
});
