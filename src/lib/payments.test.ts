import { describe, expect, it } from "vitest";
import { calculateBalanceAmount, calculateDepositAmount, sumMaterials } from "./payments";
import type { DepositCalcInput } from "./payments";

const base: DepositCalcInput = {
  quotedPrice: 20000,
  attachmentPreference: "client_provides",
  attachmentItems: [],
  accessoryItems: [],
  hairServiceCost: null,
};

describe("sumMaterials", () => {
  it("sums quantity * unitCost across items", () => {
    expect(sumMaterials([{ quantity: 2, unitCost: 1000 }, { quantity: 1, unitCost: 500 }])).toBe(2500);
  });

  it("returns 0 for an empty list", () => {
    expect(sumMaterials([])).toBe(0);
  });

  it("handles a zero-cost item", () => {
    expect(sumMaterials([{ quantity: 3, unitCost: 0 }])).toBe(0);
  });
});

describe("calculateDepositAmount", () => {
  it("returns null when there's no quoted price yet", () => {
    expect(calculateDepositAmount({ ...base, quotedPrice: null }, 50)).toBeNull();
  });

  it("standard percentage deposit — client provides their own materials", () => {
    expect(calculateDepositAmount({ ...base, quotedPrice: 20000 }, 50)).toBe(10000);
  });

  it("standard percentage deposit at a non-50 percentage", () => {
    expect(calculateDepositAmount({ ...base, quotedPrice: 30000 }, 25)).toBe(7500);
  });

  it("returns null when there's a quoted price but no deposit percentage configured", () => {
    expect(calculateDepositAmount({ ...base, quotedPrice: 20000 }, null)).toBeNull();
  });

  it("nessy_buys: deposit = full materials cost + 50% of hair service cost", () => {
    const result = calculateDepositAmount({
      ...base,
      quotedPrice: 50000,
      attachmentPreference: "nessy_buys",
      hairServiceCost: 20000,
      attachmentItems: [{ quantity: 2, unitCost: 5000 }], // 10000
      accessoryItems: [{ quantity: 1, unitCost: 2000 }], // 2000
    }, 50);
    // materials (10000 + 2000) + 50% of 20000 (10000) = 22000
    expect(result).toBe(22000);
  });

  it("nessy_buys with zero-cost materials — deposit is just 50% of hair service cost", () => {
    const result = calculateDepositAmount({
      ...base,
      quotedPrice: 10000,
      attachmentPreference: "nessy_buys",
      hairServiceCost: 10000,
      attachmentItems: [],
      accessoryItems: [],
    }, 50);
    expect(result).toBe(5000);
  });

  it("nessy_buys but hairServiceCost not yet entered — falls back to standard percentage", () => {
    // Defensive path: right after booking creation, before any quote exists, hairServiceCost
    // is null regardless of attachmentPreference. The admin's quoting UI always sets
    // hairServiceCost together with quotedPrice for nessy_buys bookings, so in practice this
    // only matters before a booking has ever been quoted.
    const result = calculateDepositAmount({
      ...base,
      quotedPrice: 20000,
      attachmentPreference: "nessy_buys",
      hairServiceCost: null,
    }, 50);
    expect(result).toBe(10000);
  });

  it("rounds to the nearest whole naira", () => {
    // 33333 * 50 / 100 = 16666.5 -> rounds to 16667
    expect(calculateDepositAmount({ ...base, quotedPrice: 33333 }, 50)).toBe(16667);
  });

  it("handles a very large quoted price without precision loss", () => {
    expect(calculateDepositAmount({ ...base, quotedPrice: 5_000_000 }, 50)).toBe(2_500_000);
  });

  it("zero quoted price deposits to zero, not null (0 is a real value, not 'unset')", () => {
    expect(calculateDepositAmount({ ...base, quotedPrice: 0 }, 50)).toBe(0);
  });
});

describe("calculateBalanceAmount", () => {
  it("returns null when there's no quoted price", () => {
    expect(calculateBalanceAmount({ ...base, quotedPrice: null, depositConfirmedAt: null }, 50)).toBeNull();
  });

  it("before the deposit is confirmed, the full quoted price is still outstanding", () => {
    expect(calculateBalanceAmount({ ...base, quotedPrice: 20000, depositConfirmedAt: null }, 50)).toBe(20000);
  });

  it("after the deposit is confirmed, balance = quoted price - deposit", () => {
    expect(calculateBalanceAmount({ ...base, quotedPrice: 20000, depositConfirmedAt: "2026-01-01T00:00:00Z" }, 50)).toBe(10000);
  });

  it("nessy_buys balance accounts for the materials+hair-service deposit", () => {
    const result = calculateBalanceAmount({
      ...base,
      quotedPrice: 50000,
      attachmentPreference: "nessy_buys",
      hairServiceCost: 20000,
      attachmentItems: [{ quantity: 2, unitCost: 5000 }],
      accessoryItems: [],
      depositConfirmedAt: "2026-01-01T00:00:00Z",
    }, 50);
    // deposit = 10000 (materials) + 10000 (50% hair service) = 20000; balance = 50000 - 20000
    expect(result).toBe(30000);
  });

  it("floors at zero instead of going negative when the deposit exceeds the quoted price", () => {
    // Admin typo: quoted far less than the materials actually cost.
    const result = calculateBalanceAmount({
      ...base,
      quotedPrice: 5000,
      attachmentPreference: "nessy_buys",
      hairServiceCost: 20000,
      attachmentItems: [{ quantity: 2, unitCost: 5000 }],
      accessoryItems: [],
      depositConfirmedAt: "2026-01-01T00:00:00Z",
    }, 50);
    expect(result).toBe(0);
  });

  it("zero balance when the deposit exactly covers the quoted price", () => {
    const result = calculateBalanceAmount({
      ...base,
      quotedPrice: 10000,
      depositConfirmedAt: "2026-01-01T00:00:00Z",
    }, 100);
    expect(result).toBe(0);
  });
});
