import { RESCHEDULABLE_STATUSES, watSlotInstant } from "./reschedule.js";
import { watDateOf } from "./reminders.js";
import type { OrderStatus } from "../types/index.js";

/**
 * What each admin booking card offers, by status and timing — one place, so the card, its
 * "More" menu and the tests agree. At most ONE primary button per card; everything else lives in
 * the "⋯ More" menu (the WhatsApp icon and the balance section are separate and always shown).
 */
export type PrimaryAction = "set_price" | "verify_payment" | "mark_completed";
export type MenuAction = "reschedule" | "confirm_without_deposit" | "history" | "move_back_to_confirmed";

export interface CardActions {
  primary: PrimaryAction | null;
  menu: { action: MenuAction; label: string }[];
}

export interface CardBooking {
  status: OrderStatus;
  date: string;
  time: string;
  lastRescheduledAt: string | null;
}

export interface BookingTiming {
  /** The appointment is on today's date (Africa/Lagos). */
  isToday: boolean;
  /** The appointment's start time has been reached (Africa/Lagos). */
  hasStarted: boolean;
  /** The appointment date is today or earlier — when "Mark Completed" becomes available. */
  isDueOrPast: boolean;
}

export function bookingTiming(date: string, time: string, now: number): BookingTiming {
  const today = watDateOf(now);
  const start = watSlotInstant(date, time);
  return {
    isToday: date === today,
    // An unreadable time counts as started once its day has begun, so nothing past is offered as upcoming.
    hasStarted: start !== null ? start <= now : date <= today,
    isDueOrPast: date <= today,
  };
}

export const PRIMARY_LABELS: Record<PrimaryAction, string> = {
  set_price: "Set Price",
  verify_payment: "Verify Payment",
  mark_completed: "Mark Completed",
};

export function cardActions(b: CardBooking, now: number): CardActions {
  const t = bookingTiming(b.date, b.time, now);
  let primary: PrimaryAction | null = null;
  if (b.status === "pending_review") primary = "set_price";
  else if (b.status === "deposit_paid") primary = "verify_payment";
  else if (b.status === "confirmed" && t.isDueOrPast) primary = "mark_completed";

  const menu: CardActions["menu"] = [];
  if (RESCHEDULABLE_STATUSES.includes(b.status)) {
    if (!t.hasStarted) menu.push({ action: "reschedule", label: "Reschedule" });
    // A confirmed booking whose time has gone by (e.g. a no-show) can still be rebooked.
    else if (b.status === "confirmed") menu.push({ action: "reschedule", label: "Reschedule (missed appointment)" });
  }
  if (b.status === "quoted") menu.push({ action: "confirm_without_deposit", label: "Confirm without deposit" });
  if (b.lastRescheduledAt) menu.push({ action: "history", label: "Reschedule history" });
  if (b.status === "completed") menu.push({ action: "move_back_to_confirmed", label: "Move back to Confirmed" });
  return { primary, menu };
}

/** Tabs that list soonest-upcoming first (then a "Past" section); the rest list most recent first. */
export type ListOrder = "upcoming_first" | "most_recent_first";
export function listOrderFor(filter: string): ListOrder {
  return filter === "completed" || filter === "cancelled" ? "most_recent_first" : "upcoming_first";
}
