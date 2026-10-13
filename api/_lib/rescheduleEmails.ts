import {
  MAX_CLIENT_RESCHEDULES, adminRescheduleWhatsAppMessage, formatSlot, newTimeDoesntWorkWhatsAppMessage,
} from "../../src/lib/reschedule.js";
import { buildWhatsAppUrl } from "../../src/lib/whatsapp.js";

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

/**
 * Sends whatever the plan calls for. Never throws: by the time this runs the reschedule has
 * already committed, so a mail failure is logged and reported back as a warning — it must
 * not turn a successful reschedule into an error the user retries.
 */
export async function sendRescheduleNotifications(
  actor: "client" | "admin", b: RescheduledBooking, ctx: RenderContext, send: SendEmail | null,
): Promise<NotificationOutcome> {
  const plan = planRescheduleNotifications(actor, b.clientEmail, ctx.adminEmail);

  const deliver = async (kind: EmailKind | null, missing: DeliveryStatus): Promise<DeliveryStatus> => {
    if (!kind) return missing;
    if (!send) return "not_configured";
    const email = renderRescheduleEmail(kind, b, ctx);
    if (!email) return missing;
    try {
      await send(email);
      return "sent";
    } catch (err) {
      console.error(`reschedule: failed to send ${kind} for ${b.reference}`, err);
      return "failed";
    }
  };

  const [clientEmail, adminEmail] = await Promise.all([
    deliver(plan.clientEmail, "no_email"),
    deliver(plan.adminEmail, "not_configured"),
  ]);

  const whatsappUrl = actor === "admin" && (plan.whatsappNeeded || clientEmail === "failed" || clientEmail === "not_configured")
    ? buildWhatsAppUrl(b.clientPhone, adminRescheduleWhatsAppMessage({
        clientName: b.clientName, reference: b.reference,
        oldDate: b.oldDate, oldTime: b.oldTime, newDate: b.newDate, newTime: b.newTime, reason: b.reason,
      }))
    : null;

  return { clientEmail, adminEmail, whatsappUrl };
}
