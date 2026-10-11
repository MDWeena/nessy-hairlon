/**
 * Hostnames style-reference links are allowed to come from — an exact-match whitelist (not a
 * "any subdomain of X" pattern), so each real-world variant a client might actually paste has
 * to be listed explicitly. Kept in one place so it's easy to extend, and mirrored by a Postgres
 * function of the same name/list in supabase/migrations (see that migration's comment for why
 * the two can't just share one source of truth).
 */
export const TRUSTED_STYLE_REFERENCE_DOMAINS = [
  "instagram.com", "www.instagram.com",
  "pinterest.com", "www.pinterest.com", "pin.it", "in.pinterest.com",
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com",
  "youtube.com", "www.youtube.com", "youtu.be",
  "twitter.com", "x.com",
  "facebook.com", "www.facebook.com", "web.facebook.com",
] as const;

export type TrustedStyleReferenceDomain = (typeof TRUSTED_STYLE_REFERENCE_DOMAINS)[number];

export const UNTRUSTED_STYLE_REFERENCE_URL_MESSAGE =
  "Please use a link from Instagram, Pinterest, TikTok, YouTube, or Facebook";
