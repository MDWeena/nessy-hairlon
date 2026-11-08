import { describe, expect, it } from "vitest";
import { dayLabel, defaultPaidOnDay, paymentDayError, paymentInstant } from "./paymentDates";

// 8 Nov 2026, 14:00 WAT
const NOW = Date.parse("2026-11-08T13:00:00Z");

describe("payment dates (Africa/Lagos)", () => {
  it("labels days like 'Sat 18 Oct'", () => {
    expect(dayLabel("2026-10-18")).toBe("Sun 18 Oct");
    expect(dayLabel("2026-10-17")).toBe("Sat 17 Oct");
  });

  it("defaults 'paid on the day' to the appointment date (today if it's still ahead)", () => {
    expect(defaultPaidOnDay("2026-10-18", NOW)).toBe("2026-10-18");
    expect(defaultPaidOnDay("2026-11-08", NOW)).toBe("2026-11-08");
    expect(defaultPaidOnDay("2026-11-20", NOW)).toBe("2026-11-08");
  });

  it("rejects future dates and dates before the booking was made", () => {
    const created = "2026-10-15T09:00:00Z"; // 15 Oct in Lagos
    expect(paymentDayError("2026-10-18", created, NOW)).toBeNull();
    expect(paymentDayError("2026-11-08", created, NOW)).toBeNull();
    expect(paymentDayError("2026-11-09", created, NOW)).toBe("The payment date can't be in the future");
    expect(paymentDayError("2026-10-14", created, NOW)).toBe("The payment date can't be before the booking was made (Thu 15 Oct)");
    expect(paymentDayError("not-a-date", created, NOW)).toBe("Choose a valid date");
    // 23:30 UTC on 14 Oct is already 15 Oct in Lagos.
    expect(paymentDayError("2026-10-14", "2026-10-14T23:30:00Z", NOW)).toMatch(/before the booking was made \(Thu 15 Oct\)/);
  });

  it("stores the appointment time on the appointment day, now for today, midday otherwise", () => {
    expect(paymentInstant("2026-10-18", NOW, { date: "2026-10-18", time: "11:00 AM" })).toBe("2026-10-18T10:00:00.000Z");
    expect(paymentInstant("2026-10-19", NOW, { date: "2026-10-18", time: "11:00 AM" })).toBe("2026-10-19T11:00:00.000Z");
    expect(paymentInstant("2026-11-08", NOW, { date: "2026-11-08", time: "4:00 PM" })).toBe(new Date(NOW).toISOString());
    expect(paymentInstant("2026-10-31", NOW)).toBe("2026-10-31T11:00:00.000Z");
  });
});
