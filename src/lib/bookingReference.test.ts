import { describe, expect, it } from "vitest";
import { shortBookingReference } from "./bookingReference";

describe("shortBookingReference", () => {
  it("prefixes BK- and uppercases the first 8 hex chars of the uuid", () => {
    expect(shortBookingReference("a3bf7fc4-1234-5678-9abc-def012345678")).toBe("BK-A3BF7FC4");
  });

  it("strips dashes before slicing, so it always gets 8 hex chars regardless of where they fall", () => {
    // Without stripping dashes first, slicing the first 8 raw characters of this uuid would
    // include a hyphen and only 7 hex digits.
    expect(shortBookingReference("ab-cdef12-3456-7890")).toBe("BK-ABCDEF12");
  });

  it("is deterministic for the same id", () => {
    const id = "f0e1d2c3-b4a5-9687-7869-564738291001";
    expect(shortBookingReference(id)).toBe(shortBookingReference(id));
  });

  it("produces different references for different ids (non-sequential/non-guessable by construction)", () => {
    const ref1 = shortBookingReference("11111111-2222-3333-4444-555555555555");
    const ref2 = shortBookingReference("99999999-8888-7777-6666-555555555555");
    expect(ref1).not.toBe(ref2);
  });
});
