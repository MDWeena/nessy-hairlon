import type { OrderStatus } from "../types/index.js";
import { hourFromLabel } from "./availability.js";

/** Mirrored in reschedule_booking() (supabase/migrations/022_booking_reschedules.sql). */
export const MAX_CLIENT_RESCHEDULES = 2;
/** How far ahead a client can move a booking — matches the new-booking calendar's window. */
export const RESCHEDULE_WINDOW_DAYS = 14;
export const RESCHEDULABLE_STATUSES: readonly OrderStatus[] = ["pending_review", "quoted", "deposit_paid", "confirmed"];

export type RescheduleErrorCode =
  | "SLOT_UNAVAILABLE"
  | "TOO_LATE"
  | "LIMIT_REACHED"
  | "INVALID_STATUS"
  | "NOT_FOUND"
  | "SAME_SLOT"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "SERVER_ERROR";

export const RESCHEDULE_ERROR_MESSAGES: Record<RescheduleErrorCode, string> = {
  SLOT_UNAVAILABLE: "That time is no longer available. Please pick another slot.",
  TOO_LATE: "Your appointment is too close to reschedule online.",
  LIMIT_REACHED: `This booking has already been rescheduled ${MAX_CLIENT_RESCHEDULES} times online.`,
  INVALID_STATUS: "This booking can no longer be rescheduled.",
  NOT_FOUND: "We couldn't find that booking. Check your reference and contact details.",
  SAME_SLOT: "That's your current time — pick a different slot.",
  RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  INVALID_REQUEST: "Something was missing from that request. Please try again.",
  UNAUTHORIZED: "Your admin session has expired. Please sign in again.",
  SERVER_ERROR: "Something went wrong. Please try again.",
};

/** The cancel endpoint shares the reschedule error codes; only these read differently. */
const CANCEL_MESSAGE_OVERRIDES: Partial<Record<RescheduleErrorCode, string>> = {
  INVALID_STATUS: "This booking can no longer be cancelled online.",
};

export function cancelErrorMessage(code: RescheduleErrorCode): string {
  return CANCEL_MESSAGE_OVERRIDES[code] ?? RESCHEDULE_ERROR_MESSAGES[code];
}

const KNOWN_CODES = new Set(Object.keys(RESCHEDULE_ERROR_MESSAGES));

export function isRescheduleErrorCode(value: unknown): value is RescheduleErrorCode {
  return typeof value === "string" && KNOWN_CODES.has(value);
}

/**
 * The instant a WAT wall-clock slot ("2026-10-20", "10:00 AM") happens. Africa/Lagos is a
 * fixed UTC+1 with no DST, so this is exact — and independent of the server's or browser's
 * own timezone, which is the bug 016_fix_reschedule_timezone.sql had to fix on the SQL side.
 */
export function watSlotInstant(date: string, time: string): number | null {
  const hour = hourFromLabel(time);
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (hour === null || !m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour - 1);
}

/** "2026-10-20", "10:00 AM" → "Tue, 20 Oct 2026 at 10:00 AM". Formatted in UTC on purpose —
 * the date string is already a WAT calendar date, so no zone shift should be applied to it. */
export function formatSlot(date: string, time: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return `${date} at ${time}`;
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${day} at ${time}`;
}

/** Client → Nessy, when online rescheduling is blocked. */
export function blockedRescheduleWhatsAppMessage(reference: string, date: string, time: string): string {
  return `Hi Nessy, I'd like to reschedule my booking ${reference} (currently ${formatSlot(date, time)}).`;
}

/** Nessy → client, after an admin reschedule when the client has no email on file. */
export function adminRescheduleWhatsAppMessage(args: {
  clientName: string; reference: string; oldDate: string; oldTime: string; newDate: string; newTime: string; reason: string | null;
}): string {
  const reason = args.reason ? ` Reason: ${args.reason}.` : "";
  return `Hi ${args.clientName}, your Nessy Hairlon appointment (${args.reference}) has been moved from ${formatSlot(args.oldDate, args.oldTime)} to ${formatSlot(args.newDate, args.newTime)}.${reason} Please reply here if the new time doesn't work for you.`;
}

/** Client → Nessy, from the "this time doesn't work" link in an admin-reschedule email. */
export function newTimeDoesntWorkWhatsAppMessage(reference: string, newDate: string, newTime: string): string {
  return `Hi Nessy, about my booking ${reference} — the new time (${formatSlot(newDate, newTime)}) doesn't work for me.`;
}

const RECENT_RESCHEDULE_MS = 7 * 24 * 60 * 60 * 1000;

/** Drives the admin's "Rescheduled" badge. */
export function isRecentlyRescheduled(lastRescheduledAt: string | null, now: number): boolean {
  if (!lastRescheduledAt) return false;
  const at = Date.parse(lastRescheduledAt);
  return !Number.isNaN(at) && now - at <= RECENT_RESCHEDULE_MS;
}

export type RescheduleBlockReason = "INVALID_STATUS" | "TOO_LATE" | "LIMIT_REACHED";

/** What the Track Booking page tells a client who can't reschedule online. */
export function blockReasonMessage(reason: RescheduleBlockReason, noticeHours: number): string {
  switch (reason) {
    case "TOO_LATE": return `Your appointment is less than ${noticeHours} hours away, so it can't be moved online.`;
    case "LIMIT_REACHED": return `This booking has already been rescheduled ${MAX_CLIENT_RESCHEDULES} times online.`;
    case "INVALID_STATUS": return "This booking can no longer be rescheduled online.";
  }
}

export interface RescheduleEligibility {
  eligible: boolean;
  reason: RescheduleBlockReason | null;
  /** Client reschedules left; null for admin (no limit). */
  remaining: number | null;
}

export interface EligibilityInput {
  status: OrderStatus;
  date: string;
  time: string;
  clientRescheduleCount: number;
  noticeHours: number;
  actor: "client" | "admin";
  now: number;
}

/** Same checks, same order, as reschedule_booking() — used to decide what the UI shows
 * before a slot is even picked. The SQL function stays the authority. */
export function getRescheduleEligibility(input: EligibilityInput): RescheduleEligibility {
  const remaining = input.actor === "client" ? Math.max(0, MAX_CLIENT_RESCHEDULES - input.clientRescheduleCount) : null;
  if (!RESCHEDULABLE_STATUSES.includes(input.status)) return { eligible: false, reason: "INVALID_STATUS", remaining };
  if (input.actor === "client") {
    const instant = watSlotInstant(input.date, input.time);
    if (instant === null || instant - input.now < input.noticeHours * 60 * 60 * 1000) {
      return { eligible: false, reason: "TOO_LATE", remaining };
    }
    if (input.clientRescheduleCount >= MAX_CLIENT_RESCHEDULES) return { eligible: false, reason: "LIMIT_REACHED", remaining };
  }
  return { eligible: true, reason: null, remaining };
}

/** "0816 127 1343", "+234 816 127 1343", "2348161271343" → "08161271343". */
export function normalizeNigerianPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) return `0${digits.slice(3)}`;
  return digits;
}

/** Strips an optional "BK-" prefix and normalizes case, matching bookings.reference_code. */
export function normalizeReference(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().replace(/^BK-?/, "");
}

export interface ContactProof {
  phone?: string | null;
  email?: string | null;
}

/** True when the supplied phone OR email belongs to this booking's client. */
export function contactMatchesBooking(proof: ContactProof, booking: { client_phone: string; client_email: string | null }): boolean {
  const phone = normalizeNigerianPhone(proof.phone);
  if (phone.length >= 10 && phone === normalizeNigerianPhone(booking.client_phone)) return true;
  const email = (proof.email ?? "").trim().toLowerCase();
  if (email && booking.client_email && email === booking.client_email.trim().toLowerCase()) return true;
  return false;
}
