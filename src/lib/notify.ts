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
  | { type: "deposit_claimed"; booking: NotificationBookingPayload }
  | { type: "payment_not_verified"; booking: NotificationBookingPayload };

/** What actually happened to the email — "skipped" means there was nobody to send it to (no
 * client email on file, or email isn't configured), which isn't a failure. */
export type NotifyResult = { status: "sent" } | { status: "skipped" } | { status: "failed"; error: string };

/**
 * Best-effort call to the send-notification serverless function. Attaches the
 * current Supabase session's access token whenever there is one (admin-
 * triggered status changes); the server requires it for "status_change" and
 * ignores it for the anon-triggered types. Never throws — the booking/status
 * update it follows has already been saved, and a mail problem mustn't undo it
 * — but reports the real outcome so the admin UI can say when an email failed.
 */
export async function notify(body: NotificationBody): Promise<NotifyResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch("/api/send-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null) as { sent?: boolean; skipped?: boolean; error?: string } | null;
    if (!res.ok) return { status: "failed", error: json?.error || `Notification request failed (HTTP ${res.status})` };
    return json?.sent ? { status: "sent" } : { status: "skipped" };
  } catch {
    return { status: "failed", error: "Couldn't reach the notification service" };
  }
}
