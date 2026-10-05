import { describe, expect, it } from "vitest";
import { addDays, getMonthRange, getWeekRange, toISODateString } from "./date";

describe("toISODateString", () => {
  it("formats as local yyyy-mm-dd, zero-padded", () => {
    expect(toISODateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(toISODateString(new Date(2026, 8, 1))).toBe("2026-09-01");
  });

  it("does not shift the date due to UTC conversion (local-time bug check)", () => {
    // A date constructed from local y/m/d components must format back to the same
    // y/m/d regardless of the runner's timezone — this is the exact class of bug the
    // WAT/UTC audit flagged elsewhere (naive local time vs UTC comparisons).
    const d = new Date(2026, 11, 31);
    expect(toISODateString(d)).toBe("2026-12-31");
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    expect(toISODateString(addDays(new Date(2026, 0, 1), 5))).toBe("2026-01-06");
  });

  it("subtracts with negative days", () => {
    expect(toISODateString(addDays(new Date(2026, 0, 10), -5))).toBe("2026-01-05");
  });

  it("rolls over a month boundary", () => {
    expect(toISODateString(addDays(new Date(2026, 0, 30), 5))).toBe("2026-02-04");
  });

  it("does not mutate the original date", () => {
    const original = new Date(2026, 0, 1);
    addDays(original, 10);
    expect(toISODateString(original)).toBe("2026-01-01");
  });
});

describe("getWeekRange", () => {
  it("resolves a Wednesday to its containing Mon-Sun week", () => {
    // 2026-01-07 is a Wednesday
    expect(getWeekRange(new Date(2026, 0, 7))).toEqual({ start: "2026-01-05", end: "2026-01-11" });
  });

  it("resolves a Monday to a week starting on itself", () => {
    expect(getWeekRange(new Date(2026, 0, 5))).toEqual({ start: "2026-01-05", end: "2026-01-11" });
  });

  it("resolves a Sunday to the week it concludes, not the next one", () => {
    expect(getWeekRange(new Date(2026, 0, 11))).toEqual({ start: "2026-01-05", end: "2026-01-11" });
  });
});

describe("getMonthRange", () => {
  it("resolves to the first and last day of a 31-day month", () => {
    expect(getMonthRange(new Date(2026, 0, 15))).toEqual({ start: "2026-01-01", end: "2026-01-31" });
  });

  it("resolves correctly for February in a non-leap year", () => {
    expect(getMonthRange(new Date(2026, 1, 10))).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("resolves correctly for February in a leap year", () => {
    expect(getMonthRange(new Date(2028, 1, 10))).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
});
