const FALLBACK_WHATSAPP_NUMBER = "2348161271343";

/** Converts a locally-formatted Nigerian number (e.g. "0816 127 1343") into the digits-only, country-code-prefixed form wa.me expects. */
export function toWhatsAppNumber(raw: string | undefined): string {
  if (!raw) return FALLBACK_WHATSAPP_NUMBER;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return FALLBACK_WHATSAPP_NUMBER;
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string | undefined, message: string): string {
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;
}
