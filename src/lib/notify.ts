import { supabase } from "./supabase";
import type { OrderStatus } from "../types";

export interface NotificationBookingPayload {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string;
  booking_date: string;
  booking_time: string;
  status: OrderStatus;
  quoted_price: number | null;
}

export type NotificationBody =
  | { type: "new_booking"; booking: NotificationBookingPayload }
  | { type: "status_change"; booking: NotificationBookingPayload; previousStatus: OrderStatus }
  | { type: "client_reschedule"; booking: NotificationBookingPayload; previousDate: string; previousTime: string }
  | { type: "client_cancellation"; booking: NotificationBookingPayload };

/**
 * Best-effort call to the send-notification serverless function. Attaches the
 * current Supabase session's access token whenever there is one (admin-
 * triggered status changes); the server requires it for "status_change" and
 * ignores it for the anon-triggered types. Failures here never block the
 * booking/status update itself.
 */
export async function notify(body: NotificationBody) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    await fetch("/api/send-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Notification failures shouldn't block the booking/status update itself.
  }
}
