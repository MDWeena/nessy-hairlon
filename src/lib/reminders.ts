import { hourFromLabel } from "./availability.js";
import { watSlotInstant } from "./reschedule.js";
import type { OrderStatus } from "../types/index.js";

/**
 * Appointment reminders, built for a once-a-day cron (vercel.json: 05:00 UTC = 06:00 WAT, and
 * Vercel's Hobby plan may fire it any time within that hour).
 *
 * The reminder_type values are the original ones (005_reminders.sql) but now mean:
 *   '24h_before' → the "day before" email, sent at the morning run the day BEFORE the appointment.
 *   '2h_before'  → the "morning of" email, sent at the morning run ON the appointment day.
 *
 * Whether to send is decided from the booking's CURRENT date/time in Africa/Lagos, never from
 * booking_reminders.scheduled_for. That keeps rows written by older code, rows rebuilt by
 * reschedule_booking() (022), and rescheduled bookings all correct without a migration.
 */
export type ReminderType = "24h_before" | "2h_before";

const WAT_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year (no DST)
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Africa/Lagos calendar date ("YYYY-MM-DD") of an instant. Independent of the host timezone. */
export function watDateOf(ms: number): string {
  return new Date(ms + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

/** "2026-12-31", +1 → "2027-01-01". Pure calendar arithmetic, no timezone involved. */
export function addDaysToDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The WAT day a reminder goes out: the day before ('24h_before') or the day of ('2h_before'). */
export function reminderSendDay(type: ReminderType, bookingDate: string): string {
  return type === "24h_before" ? addDaysToDate(bookingDate, -1) : bookingDate;
}

/** 00:00 WAT on the send day, as an ISO instant — what scheduled_for now records. */
export function reminderScheduledFor(type: ReminderType, bookingDate: string): string {
  return new Date(Date.parse(`${reminderSendDay(type, bookingDate)}T00:00:00Z`) - WAT_OFFSET_MS).toISOString();
}

/** Rows to insert when a booking becomes confirmed: one per reminder whose send day hasn't passed
 * and whose appointment is still ahead. Same result whatever timezone the browser is in. */
export function buildReminderRows(booking: { id: string; booking_date: string; booking_time: string }, now: number) {
  const appointment = watSlotInstant(booking.booking_date, booking.booking_time);
  if (appointment === null || appointment <= now) return [];
  const today = watDateOf(now);
  return (["24h_before", "2h_before"] as const)
    .filter(type => reminderSendDay(type, booking.booking_date) >= today)
    .map(type => ({ booking_id: booking.id, reminder_type: type, scheduled_for: reminderScheduledFor(type, booking.booking_date) }));
}

export interface ReminderBooking {
  status: OrderStatus;
  booking_date: string;
  booking_time: string;
  client_email: string | null;
}

export type ReminderDecision =
  | { action: "send"; reason: string }
  /** Mark the row handled without sending — it can never become valid again. */
  | { action: "skip"; reason: string }
  /** Leave the row alone — its send day is still ahead. */
  | { action: "wait"; reason: string };

/** The one place the send/skip/wait rules live. Re-evaluated from scratch on every run, so a
 * retry after a failed send gets exactly the same checks as a first attempt. */
export function decideReminder(type: string, booking: ReminderBooking | null, now: number): ReminderDecision {
  if (type !== "24h_before" && type !== "2h_before") return { action: "skip", reason: `unknown reminder type "${type}"` };
  if (!booking) return { action: "skip", reason: "booking no longer exists" };
  if (booking.status === "cancelled") return { action: "skip", reason: "booking cancelled" };
  if (booking.status === "completed") return { action: "skip", reason: "booking completed" };

  const appointment = watSlotInstant(booking.booking_date, booking.booking_time);
  if (appointment === null || hourFromLabel(booking.booking_time) === null) return { action: "skip", reason: `unreadable appointment time "${booking.booking_time}"` };
  if (appointment <= now) return { action: "skip", reason: "appointment has already started or passed" };

  const today = watDateOf(now);
  const sendDay = reminderSendDay(type, booking.booking_date);
  if (sendDay < today) return { action: "skip", reason: `send day ${sendDay} has passed (appointment ${booking.booking_date})` };
  if (sendDay > today) return { action: "wait", reason: `due on ${sendDay}` };

  // Today is the send day. These can't improve before the next run, by which time the send day
  // will have passed, so they're final.
  if (booking.status !== "confirmed") return { action: "skip", reason: `booking not confirmed (${booking.status})` };
  if (!booking.client_email?.trim()) return { action: "skip", reason: "no client email" };
  return { action: "send", reason: type === "24h_before" ? "day-before reminder" : "morning-of reminder" };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-19" → "Monday, 19 October 2026". Built by hand so it never depends on ICU data. */
export function formatLongDate(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
