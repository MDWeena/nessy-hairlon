import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "../src/types/database.js";

function getAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient<Database>(supabaseUrl, serviceRoleKey);
}

function reminderSubject(reminderType: string): string {
  return reminderType === "24h_before"
    ? "Reminder: Your Nessy Hairlon appointment is tomorrow"
    : "Reminder: Your Nessy Hairlon appointment is in 2 hours";
}

function renderReminderEmail(booking: { booking_date: string; booking_time: string }, serviceNames: string[], siteUrl: string, reminderType: string): string {
  const when = reminderType === "24h_before" ? "tomorrow" : "in 2 hours";
  return `
    <h2>See you ${when}!</h2>
    <p>Date: <strong>${booking.booking_date}</strong></p>
    <p>Time: <strong>${booking.booking_time}</strong></p>
    <p>Service: <strong>${serviceNames.length > 0 ? serviceNames.join(", ") : "Custom style"}</strong></p>
    <p>Location: Lagos, Nigeria</p>
    <p style="margin-top:16px;font-size:13px;color:#666;">
      Need to reschedule? Track your booking at <a href="${siteUrl}/track">${siteUrl}/track</a>
    </p>
  `;
}

/**
 * Sends due appointment reminders (see supabase/migrations/005_reminders.sql).
 * Intended to run on a schedule (see the "crons" entry in vercel.json — cron
 * frequency below once/day requires a Vercel Pro plan); can also be triggered
 * manually. Uses the service-role key throughout since this has no end user —
 * booking_reminders' RLS only governs authenticated/browser access.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Vercel Cron requests are same-origin and unauthenticated by default; if a
  // CRON_SECRET is configured, require it so this endpoint can't be triggered
  // (and made to spam clients) by an outsider who guesses the URL.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const adminClient = getAdminClient();
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!adminClient || !resendApiKey) {
    res.status(200).json({ success: true, skipped: true, reason: "Not configured" });
    return;
  }

  const { data: dueReminders, error } = await adminClient
    .from("booking_reminders")
    .select("id, booking_id, reminder_type")
    .lte("scheduled_for", new Date().toISOString())
    .is("sent_at", null);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!dueReminders || dueReminders.length === 0) {
    res.status(200).json({ success: true, sent: 0, skipped: 0, total: 0 });
    return;
  }

  const resend = new Resend(resendApiKey);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Nessy Hairlon <onboarding@resend.dev>";
  const siteUrl = `https://${req.headers.host}`;

  let sent = 0;
  let skipped = 0;

  for (const reminder of dueReminders) {
    const markSent = () => adminClient.from("booking_reminders").update({ sent_at: new Date().toISOString() }).eq("id", reminder.id);

    const { data: booking } = await adminClient.from("bookings").select("*").eq("id", reminder.booking_id).maybeSingle();
    if (!booking || booking.status === "cancelled" || !booking.client_email) {
      await markSent();
      skipped++;
      continue;
    }

    let serviceNames: string[] = [];
    if (booking.service_ids.length > 0) {
      const { data: services } = await adminClient.from("services").select("id, name").in("id", booking.service_ids);
      serviceNames = (services ?? []).map(s => s.name);
    }

    try {
      await resend.emails.send({
        from: fromAddress,
        to: booking.client_email,
        subject: reminderSubject(reminder.reminder_type),
        html: renderReminderEmail(booking, serviceNames, siteUrl, reminder.reminder_type),
      });
      sent++;
    } catch (err) {
      console.error("process-reminders: failed to send", reminder.id, err);
      continue; // leave sent_at null so a later run retries it
    }

    await markSent();
  }

  res.status(200).json({ success: true, sent, skipped, total: dueReminders.length });
}
