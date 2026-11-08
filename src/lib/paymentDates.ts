import { watSlotInstant } from "./reschedule.js";
import { watDateOf } from "./reminders.js";

/**
 * Dates for payments Nessy records after the fact (e.g. "Client paid in full on the day", or
 * Mark Balance Paid days later). Money received is counted in the month it ARRIVED, so the
 * recorded date must be the real one. All dates are Africa/Lagos calendar days (YYYY-MM-DD).
 */

/** "Sat 18 Oct" */
export function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
}

/** The earliest day a payment for this booking can be dated: the day it was made (Lagos). */
export function earliestPaymentDay(createdAt: string | null | undefined): string | null {
  return createdAt ? watDateOf(Date.parse(createdAt)) : null;
}

/** Why this day can't be used as the payment date, or null if it's fine. */
export function paymentDayError(day: string, createdAt: string | null | undefined, now: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return "Choose a valid date";
  if (day > watDateOf(now)) return "The payment date can't be in the future";
  const earliest = earliestPaymentDay(createdAt);
  if (earliest && day < earliest) return `The payment date can't be before the booking was made (${dayLabel(earliest)})`;
  return null;
}

/**
 * The timestamp to store for a payment received on `day`: now if it's today; the appointment's
 * start time if it's the appointment day (and that time has passed); otherwise midday in Lagos.
 */
export function paymentInstant(day: string, now: number, appointment?: { date: string; time: string }): string {
  if (day === watDateOf(now)) return new Date(now).toISOString();
  if (appointment && day === appointment.date) {
    const start = watSlotInstant(appointment.date, appointment.time);
    if (start !== null && start <= now) return new Date(start).toISOString();
  }
  return new Date(`${day}T11:00:00Z`).toISOString(); // 12:00 WAT
}

/** The default "paid on the day" date: the appointment day, or today if that's still ahead. */
export function defaultPaidOnDay(appointmentDate: string, now: number): string {
  const today = watDateOf(now);
  return appointmentDate <= today ? appointmentDate : today;
}
