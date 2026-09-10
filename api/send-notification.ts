import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { statusColors } from "../src/constants/statusColors";
import type { BookingStatus } from "../src/types/database";

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
  | { type: "status_change"; booking: BookingNotificationData; previousStatus: BookingStatus };

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
    res.status(500).json({ error: "Server is not configured for email notifications" });
    return;
  }

  const payload = req.body as NotificationPayload | undefined;
  if (!payload || !payload.type || !payload.booking) {
    res.status(400).json({ error: "Invalid notification payload" });
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
        await resend.emails.send({
          from: fromAddress,
          to: payload.booking.client_email,
          subject: `Your Nessy Hairlon booking is now ${statusColors[payload.booking.status].label}`,
          html: renderStatusChangeEmail(payload.booking, payload.previousStatus),
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
