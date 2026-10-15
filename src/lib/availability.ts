import { addDays, toISODateString } from "./date.js";
import type { BookingDay } from "../types/index.js";

/**
 * The booking-availability rules, as pure functions so useAvailability (new bookings + the
 * reschedule pickers) and the tests share one definition. The authoritative server-side copy
 * of these same rules lives in reschedule_booking() (supabase/migrations/
 * 022_booking_reschedules.sql) — keep the two in step when changing either.
 */

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface AvailabilitySlot {
  hour: number;
  label: string;
  isBooked: boolean;
  isBlocked: boolean;
  /** Falls within the business's configured min_booking_notice_hours window from right now. */
  isTooSoon: boolean;
  /** Not itself booked, but within min_gap_hours of another booking that day (either direction). */
  isBlockedByGap: boolean;
}

export interface AvailabilityDay {
  date: Date;
  dayKey: string;
  dateLabel: string;
  fullLabel: string;
  isOpen: boolean;
  isDayBlocked: boolean;
  slots: AvailabilitySlot[];
  bookingCount: number;
  maxSlotsPerDay: number;
  minGapHours: number;
  /** bookingCount >= maxSlotsPerDay — the whole day is at capacity regardless of which hours are free. */
  isFull: boolean;
}

export interface ScheduleDefaultRow {
  day_key: string;
  is_open: boolean;
  start_hour: number;
  end_hour: number;
  max_slots_per_day: number;
  min_gap_hours: number;
}

export interface BlockedSlotRow {
  date: string;
  hour: number | null;
}

export interface BookedSlotRow {
  booking_date: string;
  booking_time: string;
}

export interface ComputeAvailabilityInput {
  today: Date;
  now: number;
  daysAhead: number;
  noticeHours: number;
  schedule: ScheduleDefaultRow[];
  blocked: BlockedSlotRow[];
  /** Non-cancelled bookings only — what public_booking_slots exposes. */
  bookings: BookedSlotRow[];
  /** A booking being rescheduled: left out entirely so it doesn't count against its own
   * capacity, block its own slot, or push its own min-gap zone onto neighbouring hours. */
  exclude?: { date: string; time: string } | null;
  /** Admin reschedules aren't held to the minimum-notice window. */
  ignoreNotice?: boolean;
}

export function formatHourLabel(hour: number): string {
  return `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? "PM" : "AM"}`;
}

export function hourFromLabel(label: string): number | null {
  const match = label.match(/^(\d{1,2}):00\s(AM|PM)$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  if (match[2] === "PM" && hour !== 12) hour += 12;
  if (match[2] === "AM" && hour === 12) hour = 0;
  return hour;
}

export function computeAvailability(input: ComputeAvailabilityInput): AvailabilityDay[] {
  const { today, now, daysAhead, noticeHours, schedule, blocked, bookings, exclude, ignoreNotice } = input;
  const noticeMs = ignoreNotice ? 0 : noticeHours * 60 * 60 * 1000;
  const scheduleMap = new Map(schedule.map(row => [row.day_key, row]));

  const blockedDaySet = new Set<string>();
  const blockedSlotSet = new Set<string>();
  for (const row of blocked) {
    if (row.hour === null) blockedDaySet.add(row.date);
    else blockedSlotSet.add(`${row.date}-${row.hour}`);
  }

  // Booked hours per date — need the full list (not just a boolean) to compute
  // the min-gap exclusion zone around each booking, in both directions.
  const bookedHoursByDate = new Map<string, number[]>();
  let excludedOnce = false;
  for (const row of bookings) {
    // The partial unique index on (booking_date, booking_time) guarantees at most one
    // non-cancelled booking per slot, so matching on date+time removes exactly the one
    // being moved — public_booking_slots doesn't expose booking ids to match on instead.
    if (exclude && !excludedOnce && row.booking_date === exclude.date && row.booking_time === exclude.time) {
      excludedOnce = true;
      continue;
    }
    const hour = hourFromLabel(row.booking_time);
    if (hour === null) continue;
    const list = bookedHoursByDate.get(row.booking_date) ?? [];
    list.push(hour);
    bookedHoursByDate.set(row.booking_date, list);
  }

  const result: AvailabilityDay[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const date = addDays(today, i);
    const dateStr = toISODateString(date);
    const dayKey = DAY_KEYS[date.getDay()];
    const sched = scheduleMap.get(dayKey);
    const isOpen = sched?.is_open ?? false;
    const isDayBlocked = blockedDaySet.has(dateStr);

    const bookedHours = bookedHoursByDate.get(dateStr) ?? [];
    const bookedHourSet = new Set(bookedHours);
    const maxSlotsPerDay = sched?.max_slots_per_day ?? 3;
    const minGapHours = sched?.min_gap_hours ?? 3;
    const isFull = bookedHours.length >= maxSlotsPerDay;

    const slots: AvailabilitySlot[] = [];
    if (isOpen && sched) {
      // Inclusive of end_hour — e.g. start=10/end=16 means the 4:00 PM slot is bookable,
      // it's the START of the last appointment, not the closing time.
      for (let h = sched.start_hour; h <= sched.end_hour; h++) {
        const appointment = new Date(date);
        appointment.setHours(h, 0, 0, 0);
        const isBooked = bookedHourSet.has(h);
        slots.push({
          hour: h,
          label: formatHourLabel(h),
          isBooked,
          isBlocked: blockedSlotSet.has(`${dateStr}-${h}`),
          isTooSoon: appointment.getTime() - now < noticeMs,
          isBlockedByGap: !isBooked && bookedHours.some(bh => Math.abs(h - bh) < minGapHours),
        });
      }
    }

    result.push({
      date, dayKey,
      dateLabel: `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`,
      fullLabel: `${dayKey}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`,
      isOpen, isDayBlocked, slots,
      bookingCount: bookedHours.length, maxSlotsPerDay, minGapHours, isFull,
    });
  }
  return result;
}

export function toBookingDays(days: AvailabilityDay[]): BookingDay[] {
  return days
    .filter(d => d.isOpen && !d.isDayBlocked && !d.isFull)
    .map(d => {
      const available = d.slots.filter(s => !s.isBooked && !s.isBlocked && !s.isTooSoon && !s.isBlockedByGap);
      return {
        key: d.dayKey, label: d.fullLabel, date: toISODateString(d.date),
        slots: available.map(s => s.label), slotCount: available.length,
      };
    })
    .filter(d => d.slotCount > 0);
}
