import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.js";
import { closeMonths, supabaseMonthCloseRepo } from "./_lib/monthClose.js";

/**
 * Month close for the Finances module (vercel.json cron, daily 01:00 UTC = 02:00 WAT). On the
 * 1st it stores last month's figures and insights in monthly_reports ("on schedule"); on any other
 * day there's nothing to do unless a month is still unclosed ("catch-up"). `?dryRun=1` reports what it would close without
 * writing. Same CRON_SECRET guard as the other cron routes; writes with the service role.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(200).json({ success: true, skipped: true, reason: "Not configured" });
    return;
  }
  try {
    const result = await closeMonths(
      supabaseMonthCloseRepo(createClient<Database>(supabaseUrl, serviceRoleKey)),
      Date.now(),
      req.query?.dryRun === "1" || req.query?.dryRun === "true",
    );
    if (result.skipped) console.log(`close-month: nothing closed — ${result.skipped}`);
    else if (result.closed.length === 0) console.log(`close-month: nothing due (closed already: ${result.alreadyClosed.join(", ") || "none"})`);
    for (const c of result.closed) {
      console.log(`close-month: ${result.dryRun ? "[dry run] would close" : "closed"} ${c.month} (${c.reason}) — profit ${c.profit}, ${c.insights} insights, ${c.productsMissing} bookings missing product cost`);
    }
    res.status(200).json(result);
  } catch (err) {
    console.error("close-month: run failed", err);
    res.status(500).json({ error: "Failed to close the month" });
  }
}
