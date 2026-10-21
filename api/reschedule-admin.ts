import type { VercelRequest, VercelResponse } from "@vercel/node";
import { errorResult, handleAdminReschedule, productionEnv } from "./_lib/reschedule.js";
import { siteUrl } from "./_lib/siteUrl.js";

/** Admin reschedule endpoint (requires the admin's Supabase JWT) — see handleAdminReschedule. */
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
  const { status, body } = await handleAdminReschedule(env, req.body, req.headers.authorization, siteUrl(req.headers.host));
  res.status(status).json(body);
}
