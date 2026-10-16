import {
  MAX_CLIENT_RESCHEDULES, adminRescheduleWhatsAppMessage, formatSlot, newTimeDoesntWorkWhatsAppMessage,
} from "../../src/lib/reschedule.js";
import { buildWhatsAppUrl } from "../../src/lib/whatsapp.js";
import { statusColors } from "../../src/constants/statusColors.js";
import type { BookingStatus } from "../../src/types/database.js";

export interface RescheduledBooking {
  reference: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  reason: string | null;
  clientRescheduleCount: number;
}

export type EmailKind = "client_rescheduled_by_client" | "admin_alert_client_rescheduled" | "client_rescheduled_by_admin" | "admin_copy_admin_rescheduled";

export interface NotificationPlan {
  clientEmail: EmailKind | null;
  adminEmail: EmailKind | null;
  /** Admin reschedule of a client with no email: the admin has to tell them on WhatsApp. */
  whatsappNeeded: boolean;
}

/** Who gets told what — pure so the routing is testable on its own. */
export function planRescheduleNotifications(actor: "client" | "admin", clientEmail: string | null, adminEmail: string | null): NotificationPlan {
  const hasClientEmail = !!clientEmail?.trim();
  if (actor === "client") {
    return {
      clientEmail: hasClientEmail ? "client_rescheduled_by_client" : null,
      adminEmail: adminEmail ? "admin_alert_client_rescheduled" : null,
      whatsappNeeded: false,
    };
  }
  return {
    clientEmail: hasClientEmail ? "client_rescheduled_by_admin" : null,
    adminEmail: adminEmail ? "admin_copy_admin_rescheduled" : null,
    whatsappNeeded: !hasClientEmail,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function ctaButton(href: string, label: string): string {
  return `
    <p style="margin-top:20px">
      <a href="${href}" style="display:inline-block;padding:10px 24px;background:#C49A6C;color:#0A0A0A;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px">${label}</a>
    </p>`;
}

function changeTable(b: RescheduledBooking): string {
  return `
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#888">Was</td><td style="padding:4px 0;text-decoration:line-through;color:#888">${formatSlot(b.oldDate, b.oldTime)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888">Now</td><td style="padding:4px 0"><strong style="color:#C49A6C">${formatSlot(b.newDate, b.newTime)}</strong></td></tr>
    </table>`;
}

export interface RenderedEmail {
  to: string;
  subject: string;
  html: string;
}

export interface RenderContext {
  siteUrl: string;
  adminEmail: string | null;
  nessyPhone: string | null;
}

export function renderRescheduleEmail(kind: EmailKind, b: RescheduledBooking, ctx: RenderContext): RenderedEmail | null {
  const ref = escapeHtml(b.reference);
  const name = escapeHtml(b.clientName);
  const trackLink = `${ctx.siteUrl}/track`;
  const adminLink = `${ctx.siteUrl}/admin`;

  switch (kind) {
    case "client_rescheduled_by_client":
      if (!b.clientEmail) return null;
      return {
        to: b.clientEmail,
        subject: "Your Nessy Hairlon appointment has been rescheduled",
        html: `
          <h2>Your appointment has been moved</h2>
          <p>Hi ${name}, your booking <strong>${ref}</strong> is now:</p>
          ${changeTable(b)}
          <p style="font-size:13px;color:#888">Online reschedules used: ${b.clientRescheduleCount} of ${MAX_CLIENT_RESCHEDULES}.</p>
          ${ctaButton(trackLink, "Track Your Booking")}`,
      };

    case "admin_alert_client_rescheduled":
      if (!ctx.adminEmail) return null;
      return {
        to: ctx.adminEmail,
        subject: `Client rescheduled: ${b.clientName}`,
        html: `
          <h2>A client rescheduled their appointment</h2>
          <p><strong>${name}</strong> (${escapeHtml(b.clientPhone)}) moved booking <strong>${ref}</strong>:</p>
          ${changeTable(b)}
          <p>Online reschedules used: <strong>${b.clientRescheduleCount} of ${MAX_CLIENT_RESCHEDULES}</strong></p>
          ${ctaButton(adminLink, "View Booking")}`,
      };

    case "client_rescheduled_by_admin": {
      if (!b.clientEmail) return null;
      const replyLink = buildWhatsAppUrl(ctx.nessyPhone ?? undefined, newTimeDoesntWorkWhatsAppMessage(b.reference, b.newDate, b.newTime));
      return {
        to: b.clientEmail,
        subject: "Nessy has moved your appointment",
        html: `
          <h2>Your appointment time has changed</h2>
          <p>Hi ${name}, Nessy has moved your booking <strong>${ref}</strong>:</p>
          ${changeTable(b)}
          ${b.reason ? `<p><strong>Reason:</strong> ${escapeHtml(b.reason)}</p>` : ""}
          ${ctaButton(trackLink, "Track Your Booking")}
          <p style="font-size:13px;margin-top:16px">Doesn't work for you? <a href="${replyLink}" style="color:#C49A6C">Reply on WhatsApp</a> and we'll sort it out.</p>`,
      };
    }

    case "admin_copy_admin_rescheduled":
      if (!ctx.adminEmail) return null;
      return {
        to: ctx.adminEmail,
        subject: `Rescheduled: ${b.clientName} → ${formatSlot(b.newDate, b.newTime)}`,
        html: `
          <p>You moved <strong>${name}</strong>'s booking <strong>${ref}</strong>:</p>
          ${changeTable(b)}
          ${b.reason ? `<p><strong>Reason given:</strong> ${escapeHtml(b.reason)}</p>` : ""}
          <p style="font-size:13px;color:#888">${b.clientEmail ? "The client has been emailed." : "This client has no email — notify them on WhatsApp."}</p>`,
      };
  }
}

export type DeliveryStatus = "sent" | "failed" | "no_email" | "not_configured";

export interface NotificationOutcome {
  clientEmail: DeliveryStatus;
  adminEmail: DeliveryStatus;
  /** Prefilled wa.me link to the client — set when the admin has to tell them manually. */
  whatsappUrl: string | null;
}

export type SendEmail = (email: RenderedEmail) => Promise<void>;

/** Renders and sends one email, reporting the result instead of throwing. */
async function deliver(
  send: SendEmail | null, render: () => RenderedEmail | null, missing: DeliveryStatus, label: string,
): Promise<DeliveryStatus> {
  if (!send) return "not_configured";
  const email = render();
  if (!email) return missing;
  try {
    await send(email);
    return "sent";
  } catch (err) {
    console.error(`notification: failed to send ${label}`, err);
    return "failed";
  }
}

/**
 * Sends whatever the plan calls for. Never throws: by the time this runs the reschedule has
 * already committed, so a mail failure is logged and reported back as a warning — it must
 * not turn a successful reschedule into an error the user retries.
 */
export async function sendRescheduleNotifications(
  actor: "client" | "admin", b: RescheduledBooking, ctx: RenderContext, send: SendEmail | null,
): Promise<NotificationOutcome> {
  const plan = planRescheduleNotifications(actor, b.clientEmail, ctx.adminEmail);
  const send1 = (kind: EmailKind | null, missing: DeliveryStatus) => kind
    ? deliver(send, () => renderRescheduleEmail(kind, b, ctx), missing, `${kind} for ${b.reference}`)
    : Promise.resolve(missing);

  const [clientEmail, adminEmail] = await Promise.all([
    send1(plan.clientEmail, "no_email"),
    send1(plan.adminEmail, "not_configured"),
  ]);

  const whatsappUrl = actor === "admin" && (plan.whatsappNeeded || clientEmail === "failed" || clientEmail === "not_configured")
    ? buildWhatsAppUrl(b.clientPhone, adminRescheduleWhatsAppMessage({
        clientName: b.clientName, reference: b.reference,
        oldDate: b.oldDate, oldTime: b.oldTime, newDate: b.newDate, newTime: b.newTime, reason: b.reason,
      }))
    : null;

  return { clientEmail, adminEmail, whatsappUrl };
}

// ─── Client cancellation ───────────────────────────────────────────────────────────────────

export interface CancelledBooking {
  reference: string;
  bookingId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  date: string;
  time: string;
  previousStatus: BookingStatus;
}

export type CancelEmailKind = "client_cancelled_by_client" | "admin_alert_client_cancelled";

export interface CancelNotificationPlan {
  clientEmail: CancelEmailKind | null;
  adminEmail: CancelEmailKind | null;
}

/** Same routing as a client reschedule: the client is emailed if they gave an email, the
 * admin always is (when configured). Nobody needs a WhatsApp nudge — the client did it. */
export function planCancelNotifications(clientEmail: string | null, adminEmail: string | null): CancelNotificationPlan {
  return {
    clientEmail: clientEmail?.trim() ? "client_cancelled_by_client" : null,
    adminEmail: adminEmail ? "admin_alert_client_cancelled" : null,
  };
}

export function renderCancelEmail(kind: CancelEmailKind, b: CancelledBooking, ctx: RenderContext): RenderedEmail | null {
  const ref = escapeHtml(b.reference);
  const name = escapeHtml(b.clientName);
  const slot = formatSlot(b.date, b.time);
  const hadDeposit = b.previousStatus === "deposit_paid" || b.previousStatus === "confirmed";

  switch (kind) {
    case "client_cancelled_by_client":
      if (!b.clientEmail) return null;
      return {
        to: b.clientEmail,
        subject: "Your Nessy Hairlon appointment has been cancelled",
        html: `
          <h2>Your appointment has been cancelled</h2>
          <p>Hi ${name}, your booking <strong>${ref}</strong> for <strong>${slot}</strong> has been cancelled.</p>
          <p style="font-size:13px;color:#888">Didn't mean to? Contact Nessy as soon as possible — the slot may be given to someone else.</p>
          ${ctaButton(`${ctx.siteUrl}/book`, "Book Again")}`,
      };

    case "admin_alert_client_cancelled":
      if (!ctx.adminEmail) return null;
      return {
        to: ctx.adminEmail,
        subject: `Client cancelled: ${b.clientName}`,
        html: `
          <h2>A client cancelled their appointment</h2>
          <p><strong>${name}</strong> (${escapeHtml(b.clientPhone)}) cancelled booking <strong>${ref}</strong> for <strong>${slot}</strong>.</p>
          <p>Status before cancelling: <strong>${statusColors[b.previousStatus].label}</strong>${hadDeposit ? " — a deposit may have been paid." : ""}</p>
          ${ctaButton(`${ctx.siteUrl}/admin?booking=${b.bookingId}`, "View Booking")}`,
      };
  }
}

export interface CancelNotificationOutcome {
  clientEmail: DeliveryStatus;
  adminEmail: DeliveryStatus;
}

/** Never throws — the cancellation has already committed (see sendRescheduleNotifications). */
export async function sendCancelNotifications(b: CancelledBooking, ctx: RenderContext, send: SendEmail | null): Promise<CancelNotificationOutcome> {
  const plan = planCancelNotifications(b.clientEmail, ctx.adminEmail);
  const send1 = (kind: CancelEmailKind | null, missing: DeliveryStatus) => kind
    ? deliver(send, () => renderCancelEmail(kind, b, ctx), missing, `${kind} for ${b.reference}`)
    : Promise.resolve(missing);
  const [clientEmail, adminEmail] = await Promise.all([
    send1(plan.clientEmail, "no_email"),
    send1(plan.adminEmail, "not_configured"),
  ]);
  return { clientEmail, adminEmail };
}
