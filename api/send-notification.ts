import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { statusColors } from "../src/constants/statusColors.js";
import type { BookingStatus } from "../src/types/database.js";

function getAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Verifies a bearer token against Supabase Auth using the service-role key.
 * Returns the authenticated user's id, or null if the header is missing/invalid.
 */
async function getAuthenticatedUserId(authHeader: string | undefined): Promise<string | null> {
  const adminClient = getAdminClient();
  if (!authHeader?.startsWith("Bearer ") || !adminClient) return null;

  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** "new_booking" notifications come from anon clients (no session) — instead, confirm the referenced booking is real. */
async function bookingExists(bookingId: string): Promise<boolean> {
  const adminClient = getAdminClient();
  if (!adminClient) return false;

  const { data } = await adminClient.from("bookings").select("id").eq("id", bookingId).maybeSingle();
  return !!data;
}

interface PaymentSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  depositPercentage: number;
}

async function fetchPaymentSettings(): Promise<PaymentSettings | null> {
  const adminClient = getAdminClient();
  if (!adminClient) return null;

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

interface BookingNotificationData {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  quoted_price: number | null;
}

type NotificationPayload =
  | { type: "new_booking"; booking: BookingNotificationData }
  | { type: "status_change"; booking: BookingNotificationData; previousStatus: BookingStatus }
  | { type: "client_reschedule"; booking: BookingNotificationData; previousDate: string; previousTime: string }
  | { type: "client_cancellation"; booking: BookingNotificationData };

function formatPrice(price: number | null): string {
  return price != null ? `₦${price.toLocaleString()}` : "Pending";
}

function renderNewBookingEmail(booking: BookingNotificationData): string {
  return `
    <h2>New booking request</h2>
    <p><strong>${booking.client_name}</strong> requested an appointment on <strong>${booking.booking_date}</strong> at <strong>${booking.booking_time}</strong>.</p>
    <p>Phone: ${booking.client_phone}</p>
    ${booking.client_email ? `<p>Email: ${booking.client_email}</p>` : ""}
    <p>Status: ${statusColors[booking.status].label}</p>
  `;
}

function renderQuoteReadyEmail(booking: BookingNotificationData): string {
  return `
    <h2>Your Nessy Hairlon Quote is Ready</h2>
    <p>Your request for <strong>${booking.booking_date}</strong> at <strong>${booking.booking_time}</strong> has been priced.</p>
    <p>Quoted price: <strong>${formatPrice(booking.quoted_price)}</strong></p>
    <p>Reply or confirm to secure your slot.</p>
  `;
}

function renderBookingConfirmedEmail(booking: BookingNotificationData, settings: PaymentSettings | null): string {
  const paymentBlock = settings
    ? `<p>A ${settings.depositPercentage}% deposit secures your slot. Transfer to:</p>
       <p>Bank: <strong>${settings.bankName}</strong><br/>
       Account: <strong>${settings.accountNumber}</strong><br/>
       Name: <strong>${settings.accountName}</strong></p>`
    : "";
  return `
    <h2>Booking Confirmed — Nessy Hairlon</h2>
    <p>Your appointment on <strong>${booking.booking_date}</strong> at <strong>${booking.booking_time}</strong> is confirmed.</p>
    ${booking.quoted_price != null ? `<p>Price: <strong>${formatPrice(booking.quoted_price)}</strong></p>` : ""}
    ${paymentBlock}
  `;
}

function renderCompletedEmail(booking: BookingNotificationData, siteUrl: string): string {
  return `
    <h2>Thank you for visiting Nessy Hairlon!</h2>
    <p>We hope you loved your appointment on <strong>${booking.booking_date}</strong>.</p>
    <p>Got a minute? <a href="${siteUrl}/review">Leave a quick review</a> — it helps Nessy a lot.</p>
  `;
}

function renderClientRescheduleEmail(booking: BookingNotificationData, previousDate: string, previousTime: string): string {
  return `
    <h2>A client rescheduled their appointment</h2>
    <p><strong>${booking.client_name}</strong> (${booking.client_phone}) moved their appointment from
      <strong>${previousDate} at ${previousTime}</strong> to <strong>${booking.booking_date} at ${booking.booking_time}</strong>.</p>
  `;
}

function renderClientCancellationEmail(booking: BookingNotificationData): string {
  return `
    <h2>A client cancelled their appointment</h2>
    <p><strong>${booking.client_name}</strong> (${booking.client_phone}) cancelled their appointment on
      <strong>${booking.booking_date} at ${booking.booking_time}</strong>.</p>
  `;
}

function renderStatusChangeEmail(booking: BookingNotificationData, previousStatus: BookingStatus): string {
  return `
    <h2>Your Nessy Hairlon booking has been updated</h2>
    <p>Your appointment on <strong>${booking.booking_date}</strong> at <strong>${booking.booking_time}</strong> changed from
      <strong>${statusColors[previousStatus].label}</strong> to <strong>${statusColors[booking.status].label}</strong>.</p>
    ${booking.quoted_price != null ? `<p>Quoted price: ${formatPrice(booking.quoted_price)}</p>` : ""}
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    // Not an error — email is an optional integration for this app. Skip silently.
    res.status(200).json({ success: true, skipped: true, reason: "Email not configured" });
    return;
  }

  const payload = req.body as NotificationPayload | undefined;
  if (!payload || !payload.type || !payload.booking) {
    res.status(400).json({ error: "Invalid notification payload" });
    return;
  }

  // "status_change" is only ever admin-triggered — require a real session.
  // The other types are triggered by anon clients (submitting, rescheduling,
  // or cancelling a booking they've already verified via reference + phone
  // against the SECURITY DEFINER functions), so instead we just confirm the
  // referenced booking actually exists (deters blind spam).
  if (payload.type === "status_change") {
    const userId = await getAuthenticatedUserId(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } else if (payload.type === "new_booking" || payload.type === "client_reschedule" || payload.type === "client_cancellation") {
    const exists = await bookingExists(payload.booking.id);
    if (!exists) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
  } else {
    res.status(400).json({ error: "Unknown notification type" });
    return;
  }

  const resend = new Resend(resendApiKey);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Nessy Hairlon <onboarding@resend.dev>";

  try {
    if (payload.type === "new_booking") {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (adminEmail) {
        await resend.emails.send({
          from: fromAddress,
          to: adminEmail,
          subject: `New booking request from ${payload.booking.client_name}`,
          html: renderNewBookingEmail(payload.booking),
        });
      }
    } else if (payload.type === "status_change") {
      if (payload.booking.client_email) {
        if (payload.booking.status === "quoted") {
          await resend.emails.send({
            from: fromAddress,
            to: payload.booking.client_email,
            subject: "Your Nessy Hairlon Quote is Ready",
            html: renderQuoteReadyEmail(payload.booking),
          });
        } else if (payload.booking.status === "confirmed") {
          const settings = await fetchPaymentSettings();
          await resend.emails.send({
            from: fromAddress,
            to: payload.booking.client_email,
            subject: "Booking Confirmed — Nessy Hairlon",
            html: renderBookingConfirmedEmail(payload.booking, settings),
          });
        } else if (payload.booking.status === "completed") {
          const siteUrl = `https://${req.headers.host}`;
          await resend.emails.send({
            from: fromAddress,
            to: payload.booking.client_email,
            subject: "Thank you for visiting Nessy Hairlon!",
            html: renderCompletedEmail(payload.booking, siteUrl),
          });
        } else {
          await resend.emails.send({
            from: fromAddress,
            to: payload.booking.client_email,
            subject: `Your Nessy Hairlon booking is now ${statusColors[payload.booking.status].label}`,
            html: renderStatusChangeEmail(payload.booking, payload.previousStatus),
          });
        }
      }
    } else if (payload.type === "client_reschedule") {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (adminEmail) {
        await resend.emails.send({
          from: fromAddress,
          to: adminEmail,
          subject: `Client rescheduled: ${payload.booking.client_name}`,
          html: renderClientRescheduleEmail(payload.booking, payload.previousDate, payload.previousTime),
        });
      }
    } else if (payload.type === "client_cancellation") {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (adminEmail) {
        await resend.emails.send({
          from: fromAddress,
          to: adminEmail,
          subject: `Client cancelled: ${payload.booking.client_name}`,
          html: renderClientCancellationEmail(payload.booking),
        });
      }
    } else {
      res.status(400).json({ error: "Unknown notification type" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-notification error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
}
