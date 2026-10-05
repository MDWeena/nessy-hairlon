import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "../src/types/database.js";
import { calculateBalanceAmount } from "../src/lib/payments.js";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

function getAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient<Database>(supabaseUrl, serviceRoleKey);
}

/** Verifies a bearer token against Supabase Auth using the service-role key — same pattern as send-notification.ts's admin-only paths. */
async function getAuthenticatedUserId(adminClient: SupabaseClient<Database>, authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

interface PaymentSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  depositPercentage: number;
}

async function fetchPaymentSettings(adminClient: SupabaseClient<Database>): Promise<PaymentSettings | null> {
  const { data } = await adminClient.from("settings").select("key, value")
    .in("key", ["bank_name", "account_number", "account_name", "deposit_percentage"]);
  if (!data) return null;

  const map = Object.fromEntries(data.map(row => [row.key, row.value]));
  return {
    bankName: String(map.bank_name ?? ""),
    accountNumber: String(map.account_number ?? ""),
    accountName: String(map.account_name ?? ""),
    depositPercentage: Number(map.deposit_percentage ?? 50),
  };
}

function formatPrice(price: number): string {
  return `₦${price.toLocaleString()}`;
}

/** Defense-in-depth: client_name is free-text entered by the client at booking time. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBalanceReminderEmail(booking: BookingRow, balanceDue: number, settings: PaymentSettings | null, siteUrl: string): string {
  const paymentBlock = settings
    ? `
      <p>Please transfer to:</p>
      <p>Bank: <strong>${settings.bankName}</strong><br/>
      Account: <strong>${settings.accountNumber}</strong><br/>
      Name: <strong>${settings.accountName}</strong></p>
    `
    : "";
  return `
    <h2>Outstanding Balance — Nessy Hairlon</h2>
    <p>Hi ${escapeHtml(booking.client_name)}, thanks again for visiting! Your appointment on <strong>${booking.booking_date}</strong> is complete, but we haven't yet received the remaining balance.</p>
    <p>Balance due: <strong style="color:#C49A6C">${formatPrice(balanceDue)}</strong></p>
    ${paymentBlock}
    <p style="margin-top:16px;font-size:13px;color:#666;">
      Questions? Track your booking at <a href="${siteUrl}/track">${siteUrl}/track</a>
    </p>
  `;
}

function balanceDueFor(booking: BookingRow, depositPercentage: number | null): number | null {
  return calculateBalanceAmount({
    quotedPrice: booking.quoted_price,
    attachmentPreference: booking.attachment_preference,
    attachmentItems: (booking.attachment_items ?? []).map(i => ({ quantity: i.quantity, unitCost: i.unit_cost })),
    accessoryItems: (booking.accessory_items ?? []).map(i => ({ quantity: i.quantity, unitCost: i.unit_cost })),
    hairServiceCost: booking.hair_service_cost,
    depositConfirmedAt: booking.deposit_confirmed_at,
  }, depositPercentage);
}

async function sendReminder(
  adminClient: SupabaseClient<Database>,
  resend: Resend,
  fromAddress: string,
  booking: BookingRow,
  settings: PaymentSettings | null,
  siteUrl: string,
): Promise<boolean> {
  if (!booking.client_email) return false;
  const balanceDue = balanceDueFor(booking, settings?.depositPercentage ?? null);
  if (balanceDue == null || balanceDue <= 0) return false;

  try {
    await resend.emails.send({
      from: fromAddress,
      to: booking.client_email,
      subject: "Outstanding balance for your Nessy Hairlon appointment",
      html: renderBalanceReminderEmail(booking, balanceDue, settings, siteUrl),
    });
  } catch (err) {
    console.error("process-balance-reminders: failed to send", booking.id, err);
    return false;
  }

  await adminClient.from("bookings").update({ balance_reminder_sent_at: new Date().toISOString() }).eq("id", booking.id);
  return true;
}

/**
 * Sends balance-payment reminders for past appointments that are still owed
 * (see supabase/migrations/013_balance_payment_tracking.sql). Two ways in:
 *
 *  - Cron sweep (GET/POST with no body, or protected by CRON_SECRET): finds
 *    every confirmed/completed booking whose date is more than 24h in the
 *    past, has a quoted price, no balance_paid_at, and hasn't already had a
 *    reminder sent — see api/process-reminders.ts for the equivalent pattern.
 *  - Manual single-booking trigger (POST { bookingId }), from the "Send
 *    Balance Reminder" button in admin Orders — requires an authenticated
 *    admin session, same as send-notification.ts's admin-only paths, and
 *    may resend even if balance_reminder_sent_at is already set.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const adminClient = getAdminClient();
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!adminClient || !resendApiKey) {
    res.status(200).json({ success: true, skipped: true, reason: "Not configured" });
    return;
  }

  const resend = new Resend(resendApiKey);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Nessy Hairlon <onboarding@resend.dev>";
  const siteUrl = `https://${req.headers.host}`;

  const manualBookingId = req.method === "POST" ? (req.body as { bookingId?: string } | undefined)?.bookingId : undefined;

  if (manualBookingId) {
    const userId = await getAuthenticatedUserId(adminClient, req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { data: booking } = await adminClient.from("bookings").select("*").eq("id", manualBookingId).maybeSingle();
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
    if (!booking.client_email) {
      res.status(400).json({ error: "This client has no email on file" });
      return;
    }

    const settings = await fetchPaymentSettings(adminClient);
    const sent = await sendReminder(adminClient, resend, fromAddress, booking, settings, siteUrl);
    res.status(200).json({ success: true, sent: sent ? 1 : 0 });
    return;
  }

  // SECURITY FIX (pre-launch audit): see api/process-reminders.ts for the same
  // fix — this used to only enforce CRON_SECRET when one happened to be set,
  // leaving the cron-sweep path open to anyone if it wasn't configured.
  // CRON_SECRET MUST be set in the Vercel project's environment variables.
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // BUG FIX (pre-launch audit): this computed "yesterday" using the UTC
  // calendar day on Vercel (server runs in UTC) and compared it against
  // booking_date, which is a Lagos/WAT (UTC+1) calendar date — during the
  // 23:00-24:00 UTC window (00:00-01:00 WAT, the first hour of each new WAT
  // day), the old `cutoffDate` was a day off from "yesterday in WAT",
  // shifting which bookings qualify by a day depending on exactly when the
  // cron fires. Computing cutoff from a WAT "now" (UTC+1) fixes this.
  const nowWat = new Date(Date.now() + 60 * 60 * 1000);
  nowWat.setUTCDate(nowWat.getUTCDate() - 1);
  const cutoffDate = nowWat.toISOString().slice(0, 10);

  const { data: dueBookings, error } = await adminClient
    .from("bookings")
    .select("*")
    .in("status", ["confirmed", "completed"])
    .not("quoted_price", "is", null)
    .is("balance_paid_at", null)
    .is("balance_reminder_sent_at", null)
    .lte("booking_date", cutoffDate);

  if (error) {
    // SECURITY FIX (pre-launch audit): was leaking raw Postgres/PostgREST error text
    // to the HTTP caller. Logged server-side instead; caller gets a generic message.
    console.error("process-balance-reminders: failed to fetch due bookings", error);
    res.status(500).json({ error: "Failed to process balance reminders" });
    return;
  }
  if (!dueBookings || dueBookings.length === 0) {
    res.status(200).json({ success: true, sent: 0, skipped: 0, total: 0 });
    return;
  }

  const settings = await fetchPaymentSettings(adminClient);

  let sent = 0;
  let skipped = 0;
  for (const booking of dueBookings) {
    const ok = await sendReminder(adminClient, resend, fromAddress, booking, settings, siteUrl);
    if (ok) sent++; else skipped++;
  }

  res.status(200).json({ success: true, sent, skipped, total: dueBookings.length });
}
