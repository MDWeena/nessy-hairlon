import { describe, expect, it } from "vitest";
import { isValidEmail, isValidNigerianPhone, isTrustedStyleReferenceUrl, styleReferenceLinkTrust } from "./validation";

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

describe("isTrustedStyleReferenceUrl", () => {
  it("accepts a trusted domain for each platform", () => {
    expect(isTrustedStyleReferenceUrl("https://www.instagram.com/p/abc123/")).toBe(true);
    expect(isTrustedStyleReferenceUrl("https://pinterest.com/pin/1")).toBe(true);
    expect(isTrustedStyleReferenceUrl("https://pin.it/abc")).toBe(true);
    expect(isTrustedStyleReferenceUrl("https://in.pinterest.com/pin/1")).toBe(true);
    expect(isTrustedStyleReferenceUrl("https://www.tiktok.com/@user/video/1")).toBe(true);
    expect(isTrustedStyleReferenceUrl("https://vm.tiktok.com/abc")).toBe(true);
    expect(isTrustedStyleReferenceUrl("https://youtu.be/abc")).toBe(true);
    expect(isTrustedStyleReferenceUrl("https://x.com/user/status/1")).toBe(true);
    expect(isTrustedStyleReferenceUrl("https://web.facebook.com/photo/1")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isTrustedStyleReferenceUrl("  https://pinterest.com/pin/1  ")).toBe(true);
  });

  it("rejects an untrusted domain", () => {
    expect(isTrustedStyleReferenceUrl("https://evil-phishing-site.com/style")).toBe(false);
  });

  it("rejects a lookalike domain that merely contains a trusted name", () => {
    expect(isTrustedStyleReferenceUrl("https://instagram.com.evil.com/p/1")).toBe(false);
  });

  it("rejects http:// even for an otherwise-trusted domain — only https:// is allowed", () => {
    expect(isTrustedStyleReferenceUrl("http://pinterest.com/pin/1")).toBe(false);
  });

  it("rejects a protocol-relative or non-http(s) scheme", () => {
    expect(isTrustedStyleReferenceUrl("//pinterest.com/pin/1")).toBe(false);
    expect(isTrustedStyleReferenceUrl("ftp://pinterest.com/pin/1")).toBe(false);
    expect(isTrustedStyleReferenceUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(isTrustedStyleReferenceUrl("not a url")).toBe(false);
    expect(isTrustedStyleReferenceUrl("")).toBe(false);
  });

  it("is case-insensitive on the hostname", () => {
    expect(isTrustedStyleReferenceUrl("https://WWW.PINTEREST.COM/pin/1")).toBe(true);
  });
});

describe("styleReferenceLinkTrust", () => {
  it("marks a trusted-domain link as trusted regardless of the revealed set", () => {
    expect(styleReferenceLinkTrust("https://pinterest.com/pin/1", new Set())).toBe("trusted");
  });

  it("marks an untrusted link as unverified-hidden until revealed", () => {
    expect(styleReferenceLinkTrust("https://evil.com/x", new Set())).toBe("unverified-hidden");
  });

  it("marks an untrusted link as unverified-revealed once the admin has clicked past the warning", () => {
    expect(styleReferenceLinkTrust("https://evil.com/x", new Set(["https://evil.com/x"]))).toBe("unverified-revealed");
  });

  it("revealing one untrusted link doesn't affect a different untrusted link", () => {
    expect(styleReferenceLinkTrust("https://evil.com/y", new Set(["https://evil.com/x"]))).toBe("unverified-hidden");
  });
});
