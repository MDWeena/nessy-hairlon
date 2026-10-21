import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clientIp, errorResult, handleClientCancel, productionEnv } from "./_lib/reschedule.js";
import { siteUrl } from "./_lib/siteUrl.js";

/** Public cancel endpoint for the Track Booking page — see handleClientCancel. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, code: "INVALID_REQUEST", message: "Method not allowed" });
    return;
  }
  const env = productionEnv();
  if (!env) {
    const { status, body } = errorResult("SERVER_ERROR");
    res.status(status).json(body);
    return;
  }
  const { status, body } = await handleClientCancel(env, req.body, clientIp(req.headers), siteUrl(req.headers.host));
  res.status(status).json(body);
}
