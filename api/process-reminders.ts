import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "../src/types/database.js";
import { DEFAULT_FROM_ADDRESS, sendEmailChecked } from "./_lib/email.js";
import { runReminders, supabaseReminderRepo } from "./_lib/reminderProcessor.js";
import { siteUrl } from "./_lib/siteUrl.js";

/**
 * Sends appointment reminders (see src/lib/reminders.ts for the rules). Runs once a day from the
 * "crons" entry in vercel.json (05:00 UTC = 06:00 WAT; the Hobby plan may fire it any time in
 * that hour). Every unsent row is re-decided from its booking's CURRENT date and status, so a
 * reminder can never go out for an appointment that has started or passed, or on the wrong day.
 *
 * `?dryRun=1` reports what a real run would do (send / skip / wait, with reasons) without
 * sending anything or writing to the database. It needs the same CRON_SECRET as a real run.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // SECURITY FIX (pre-launch audit): fails closed — CRON_SECRET MUST be set in the Vercel
  // project's environment variables for this endpoint (and the real cron schedule) to work.
  // Vercel sends this header automatically on its own cron invocations.
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const dryRun = req.query?.dryRun === "1" || req.query?.dryRun === "true";
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!supabaseUrl || !serviceRoleKey || (!resendApiKey && !dryRun)) {
    res.status(200).json({ success: true, skipped: true, reason: "Not configured" });
    return;
  }

  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  const fromAddress = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_ADDRESS;
  try {
    const result = await runReminders({
      repo: supabaseReminderRepo(createClient<Database>(supabaseUrl, serviceRoleKey)),
      send: resend ? message => sendEmailChecked(resend, fromAddress, message, "process-reminders") : null,
      siteUrl: siteUrl(req.headers.host),
      now: Date.now(),
      dryRun,
    });
    // Still 200 when some sends failed — the run itself worked, and failed reminders stay unsent
    // for the next run. The per-row outcomes show up in the Vercel cron logs.
    res.status(200).json(result);
  } catch (err) {
    // Logged server-side; the caller gets a generic message (no raw database errors).
    console.error("process-reminders: run failed", err);
    res.status(500).json({ error: "Failed to process reminders" });
  }
}
