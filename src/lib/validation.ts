import { TRUSTED_STYLE_REFERENCE_DOMAINS } from "../constants/trustedDomains";

/**
 * Nigerian phone numbers: 11 digits starting with 0 (e.g. 0816 127 1343), or the
 * +234 international form (234 + 10 digits, no leading 0). Ignores spaces/dashes
 * the user may have typed. Added as part of a pre-launch security/validation audit —
 * previously phone numbers were accepted as unvalidated free text everywhere.
 */
export function isValidNigerianPhone(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, "");
  if (/^0\d{10}$/.test(digits)) return true;
  if (/^\+?234\d{10}$/.test(digits)) return true;
  return false;
}

/** Simple, deliberately permissive email format check — not meant to replace the
 * `type="email"` input's own browser validation, just to catch obviously-malformed
 * values (e.g. "not an email") since that field is optional and HTML5 validation
 * can be bypassed (devtools, programmatic form submission, disabled JS validation). */
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/** Style-reference links must be https:// and from one of TRUSTED_STYLE_REFERENCE_DOMAINS —
 * SECURITY FIX: an earlier version of this check accepted any well-formed http(s) URL, which
 * let a client submit an arbitrary link (phishing, malware, anything) that an admin reviewing
 * the booking would then open. Enforced again at the database level (see
 * supabase/migrations/021_trusted_style_reference_domains.sql) since this client-side check
 * alone can be bypassed by calling the Supabase REST API directly. */
export function isTrustedStyleReferenceUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith("https://")) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && (TRUSTED_STYLE_REFERENCE_DOMAINS as readonly string[]).includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export type StyleReferenceLinkTrust = "trusted" | "unverified-hidden" | "unverified-revealed";

/** Which of the three states Orders.tsx renders a style-reference link in. `revealed` tracks
 * links the admin has already clicked past the "open with caution" warning for — pre-whitelist
 * data only (021_trusted_style_reference_domains.sql rejects untrusted domains outright for
 * anything submitted since), so this path should rarely/never actually be hit in practice. */
export function styleReferenceLinkTrust(url: string, revealed: ReadonlySet<string>): StyleReferenceLinkTrust {
  if (isTrustedStyleReferenceUrl(url)) return "trusted";
  return revealed.has(url) ? "unverified-revealed" : "unverified-hidden";
}
