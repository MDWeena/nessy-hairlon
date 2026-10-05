import { describe, expect, it } from "vitest";
import { isValidEmail, isValidNigerianPhone } from "./validation";

describe("isValidNigerianPhone", () => {
  it("accepts a standard 11-digit 0-prefixed number", () => {
    expect(isValidNigerianPhone("08161271343")).toBe(true);
  });

  it("accepts the same number with spaces", () => {
    expect(isValidNigerianPhone("0816 127 1343")).toBe(true);
  });

  it("accepts the same number with dashes", () => {
    expect(isValidNigerianPhone("0816-127-1343")).toBe(true);
  });

  it("accepts the +234 international form", () => {
    expect(isValidNigerianPhone("+2348161271343")).toBe(true);
  });

  it("accepts the 234 form without a leading +", () => {
    expect(isValidNigerianPhone("2348161271343")).toBe(true);
  });

  it("rejects a number that's too short", () => {
    expect(isValidNigerianPhone("08161271")).toBe(false);
  });

  it("rejects a number that's too long", () => {
    expect(isValidNigerianPhone("081612713430000")).toBe(false);
  });

  it("rejects a number not starting with 0 or 234", () => {
    expect(isValidNigerianPhone("18161271343")).toBe(false);
  });

  it("rejects free text", () => {
    expect(isValidNigerianPhone("call me maybe")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidNigerianPhone("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts a normal email", () => {
    expect(isValidEmail("client@example.com")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isValidEmail("  client@example.com  ")).toBe(true);
  });

  it("rejects a value with no @", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("rejects a value with no domain", () => {
    expect(isValidEmail("client@")).toBe(false);
  });

  it("rejects a value with no TLD", () => {
    expect(isValidEmail("client@example")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects a value containing spaces", () => {
    expect(isValidEmail("cli ent@example.com")).toBe(false);
  });
});
