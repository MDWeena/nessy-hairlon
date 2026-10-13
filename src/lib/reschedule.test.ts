import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_RESCHEDULES, adminRescheduleWhatsAppMessage, contactMatchesBooking, formatSlot, getRescheduleEligibility,
  isRecentlyRescheduled, normalizeNigerianPhone, normalizeReference, watSlotInstant, type EligibilityInput,
} from "./reschedule";
import type { OrderStatus } from "../types";

const NOW = Date.UTC(2026, 9, 13, 9, 0); // 10:00 WAT on 13 Oct

function eligibility(overrides: Partial<EligibilityInput> = {}) {
  return getRescheduleEligibility({
    status: "confirmed", date: "2026-10-20", time: "10:00 AM", clientRescheduleCount: 0,
    noticeHours: 24, actor: "client", now: NOW, ...overrides,
  });
}

describe("getRescheduleEligibility", () => {
  it.each<OrderStatus>(["pending_review", "quoted", "deposit_paid", "confirmed"])("allows %s", (status) => {
    expect(eligibility({ status })).toEqual({ eligible: true, reason: null, remaining: 2 });
  });

  it.each<OrderStatus>(["completed", "cancelled"])("blocks %s for client and admin", (status) => {
    expect(eligibility({ status }).reason).toBe("INVALID_STATUS");
    expect(eligibility({ status, actor: "admin" }).reason).toBe("INVALID_STATUS");
  });

  it("blocks a client inside the notice window, measured in WAT", () => {
    // 14 Oct 10:00 WAT is exactly 24h away — allowed; 9:00 AM is 23h away — too late.
    expect(eligibility({ date: "2026-10-14", time: "10:00 AM" }).eligible).toBe(true);
    expect(eligibility({ date: "2026-10-14", time: "9:00 AM" }).reason).toBe("TOO_LATE");
  });

  it(`blocks a client after ${MAX_CLIENT_RESCHEDULES} reschedules`, () => {
    expect(eligibility({ clientRescheduleCount: 1 })).toEqual({ eligible: true, reason: null, remaining: 1 });
    expect(eligibility({ clientRescheduleCount: 2 })).toEqual({ eligible: false, reason: "LIMIT_REACHED", remaining: 0 });
  });

  it("lets the admin past both client limits", () => {
    expect(eligibility({ actor: "admin", clientRescheduleCount: 5, date: "2026-10-13", time: "4:00 PM" }))
      .toEqual({ eligible: true, reason: null, remaining: null });
  });
});

describe("watSlotInstant", () => {
  it("treats the slot as Lagos time (UTC+1) regardless of the runtime's zone", () => {
    expect(new Date(watSlotInstant("2026-10-20", "10:00 AM")!).toISOString()).toBe("2026-10-20T09:00:00.000Z");
    expect(new Date(watSlotInstant("2026-10-20", "12:00 AM")!).toISOString()).toBe("2026-10-19T23:00:00.000Z");
  });

  it("returns null for malformed input", () => {
    expect(watSlotInstant("2026-10-20", "10:30")).toBeNull();
    expect(watSlotInstant("20/10/2026", "10:00 AM")).toBeNull();
  });
});

describe("contact verification", () => {
  const booking = { client_phone: "0816 127 1343", client_email: "Ada@Example.com" };

  it("normalizes Nigerian phone formats", () => {
    expect(normalizeNigerianPhone("+234 816 127 1343")).toBe("08161271343");
    expect(normalizeNigerianPhone("2348161271343")).toBe("08161271343");
    expect(normalizeNigerianPhone("0816-127-1343")).toBe("08161271343");
  });

  it("matches on phone or case-insensitive email", () => {
    expect(contactMatchesBooking({ phone: "+2348161271343" }, booking)).toBe(true);
    expect(contactMatchesBooking({ email: " ada@example.COM " }, booking)).toBe(true);
  });

  it("rejects a wrong phone, a wrong email, an empty proof, and a too-short phone", () => {
    expect(contactMatchesBooking({ phone: "08000000000" }, booking)).toBe(false);
    expect(contactMatchesBooking({ email: "eve@example.com" }, booking)).toBe(false);
    expect(contactMatchesBooking({}, booking)).toBe(false);
    expect(contactMatchesBooking({ phone: "1343" }, { client_phone: "1343", client_email: null })).toBe(false);
  });

  it("never matches an email against a booking that has none", () => {
    expect(contactMatchesBooking({ email: "" }, { client_phone: "080", client_email: null })).toBe(false);
  });

  it("normalizes references with or without the BK- prefix", () => {
    expect(normalizeReference(" bk-a3bf7fc4 ")).toBe("A3BF7FC4");
    expect(normalizeReference("A3BF7FC4")).toBe("A3BF7FC4");
  });
});

describe("display helpers", () => {
  it("formats a slot without shifting the calendar date", () => {
    expect(formatSlot("2026-10-20", "10:00 AM")).toBe("Tue, 20 Oct 2026 at 10:00 AM");
  });

  it("builds the no-email WhatsApp message with old → new and the reason", () => {
    const msg = adminRescheduleWhatsAppMessage({
      clientName: "Ada", reference: "BK-A3BF7FC4", oldDate: "2026-10-20", oldTime: "10:00 AM",
      newDate: "2026-10-21", newTime: "2:00 PM", reason: "Sick day",
    });
    expect(msg).toContain("BK-A3BF7FC4");
    expect(msg).toContain("Tue, 20 Oct 2026 at 10:00 AM to Wed, 21 Oct 2026 at 2:00 PM");
    expect(msg).toContain("Reason: Sick day.");
  });

  it("shows the Rescheduled badge for 7 days only", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(isRecentlyRescheduled(new Date(NOW - 6 * day).toISOString(), NOW)).toBe(true);
    expect(isRecentlyRescheduled(new Date(NOW - 8 * day).toISOString(), NOW)).toBe(false);
    expect(isRecentlyRescheduled(null, NOW)).toBe(false);
  });
});
