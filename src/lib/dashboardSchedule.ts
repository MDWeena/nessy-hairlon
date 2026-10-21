import type { Order } from "../types";

/** Statuses that are on the books as a real appointment — a completed booking still counts. */
const SCHEDULED = new Set<Order["status"]>(["confirmed", "completed"]);

/** Confirmed or completed bookings on `today`. */
export function todaysSchedule(bookings: Order[], today: string): Order[] {
  return bookings.filter(o => o.date === today && SCHEDULED.has(o.status));
}

/** Confirmed or completed bookings from `today` through `until` (inclusive). */
export function scheduledBetween(bookings: Order[], today: string, until: string): Order[] {
  return bookings.filter(o => o.date >= today && o.date <= until && SCHEDULED.has(o.status));
}
