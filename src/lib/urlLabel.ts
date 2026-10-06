const KNOWN_DOMAINS: Record<string, string> = {
  "pinterest.com": "Pinterest",
  "pin.it": "Pinterest",
  "instagram.com": "Instagram",
  "tiktok.com": "TikTok",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "twitter.com": "Twitter / X",
  "x.com": "Twitter / X",
  "facebook.com": "Facebook",
};

/** Maps a style-reference link to a short platform label for display (e.g. "pin.it/abc" ->
 * "Pinterest"), falling back to the bare hostname for anything not in the known list. */
export function labelForUrl(raw: string): string {
  try {
    const hostname = new URL(raw).hostname.replace(/^www\./, "");
    const known = Object.entries(KNOWN_DOMAINS).find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`));
    return known?.[1] ?? hostname;
  } catch {
    return raw;
  }
}
