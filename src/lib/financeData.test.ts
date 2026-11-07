import { describe, expect, it } from "vitest";
import { earliestBookings, trackingStartConfirmed, trackingStartFrom } from "./financeData";

const row = (id: string, created_at: string, client_name: string, booking_date: string, status = "completed") =>
  ({ id, created_at, client_name, booking_date, status }) as never;

describe("tracking start", () => {
  it("is unconfirmed until a date is saved, and falls back to the first booking's Lagos date meanwhile", () => {
    const bookings = [row("b", "2026-10-15T08:00:00Z", "Ngozi Eze", "2026-10-20"), row("a", "2026-10-13T23:30:00Z", "Test Booking", "2026-10-14", "cancelled")];
    expect(trackingStartConfirmed([])).toBe(false);
    expect(trackingStartFrom([], bookings)).toBe("2026-10-14"); // 23:30 UTC = 00:30 WAT next day
    const config = [{ key: "tracking_start_date", value: "2026-10-15", updated_at: "" }];
    expect(trackingStartConfirmed(config)).toBe(true);
    expect(trackingStartFrom(config, bookings)).toBe("2026-10-15");
  });

  it("lists the earliest bookings by creation (Lagos time), first name only", () => {
    const list = earliestBookings([
      row("c", "2026-10-16T09:00:00Z", "Halima", "2026-10-25"),
      row("a", "2026-10-13T23:30:00Z", "Test Booking", "2026-10-14", "cancelled"),
      row("b", "2026-10-15T08:00:00Z", "Ngozi Eze", "2026-10-20"),
    ], 2);
    expect(list).toEqual([
      { id: "a", firstName: "Test", createdDate: "2026-10-14", createdTime: "00:30", appointmentDate: "2026-10-14", status: "cancelled" },
      { id: "b", firstName: "Ngozi", createdDate: "2026-10-15", createdTime: "09:00", appointmentDate: "2026-10-20", status: "completed" },
    ]);
  });
});
