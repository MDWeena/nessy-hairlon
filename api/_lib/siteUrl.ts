export const PRODUCTION_SITE_URL = "https://nessy-hairlon.wifysolutions.com";

type Env = Record<string, string | undefined>;

/**
 * The base URL for every link in an email. BUG FIX: links used to be built from
 * `https://${req.headers.host}` — for a Vercel cron run that's the per-deployment URL
 * (nessy-hairlon-<hash>-wify-solutions.vercel.app), an immutable snapshot that keeps serving
 * old code after the next deploy. Production always links to the real domain; previews link to
 * their branch URL (which follows the branch), falling back to the request host.
 */
export function siteUrl(host?: string | string[] | null, env: Env = process.env): string {
  if (env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
  if (env.VERCEL_BRANCH_URL) return `https://${env.VERCEL_BRANCH_URL}`;
  const h = Array.isArray(host) ? host[0] : host;
  return h ? `${/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h) ? "http" : "https"}://${h}` : PRODUCTION_SITE_URL;
}
