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
