import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import { addDays, toISODateString } from "../lib/date";
import type { BookingDay } from "../types";

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface AvailabilitySlot {
  hour: number;
  label: string;
  isBooked: boolean;
  isBlocked: boolean;
}

export interface AvailabilityDay {
  date: Date;
  dayKey: string;
  dateLabel: string;
  fullLabel: string;
  isOpen: boolean;
  isDayBlocked: boolean;
  slots: AvailabilitySlot[];
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

interface UseAvailabilityResult {
  days: AvailabilityDay[];
  bookingDays: BookingDay[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  blockDay: (date: Date) => Promise<void>;
  unblockDay: (date: Date) => Promise<void>;
  blockSlot: (date: Date, hour: number) => Promise<void>;
  unblockSlot: (date: Date, hour: number) => Promise<void>;
  openDay: (dayKey: string, startHour: number, endHour: number) => Promise<void>;
  closeDay: (dayKey: string) => Promise<void>;
}

export function useAvailability(daysAhead: number = 14): UseAvailabilityResult {
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);

    const today = new Date();
    const rangeStart = toISODateString(today);
    const rangeEnd = toISODateString(addDays(today, daysAhead - 1));

    const [scheduleRes, blockedRes, bookingsRes] = await Promise.all([
      supabase.from("schedule_defaults").select("*"),
      supabase.from("blocked_slots").select("*").gte("date", rangeStart).lte("date", rangeEnd),
      // public_booking_slots exposes only booking_date/booking_time/status (no client PII),
      // so this works for anon (client booking flow) and authenticated (admin) alike.
      supabase.from("public_booking_slots").select("booking_date, booking_time, status")
        .gte("booking_date", rangeStart).lte("booking_date", rangeEnd),
    ]);

    if (scheduleRes.error) { setError(scheduleRes.error.message); setLoading(false); return; }
    if (blockedRes.error) { setError(blockedRes.error.message); setLoading(false); return; }
    if (bookingsRes.error) { setError(bookingsRes.error.message); setLoading(false); return; }

    const scheduleMap = new Map(scheduleRes.data.map(row => [row.day_key, row]));

    const blockedDaySet = new Set<string>();
    const blockedSlotSet = new Set<string>();
    for (const row of blockedRes.data) {
      if (row.hour === null) {
        blockedDaySet.add(row.date);
      } else {
        blockedSlotSet.add(`${row.date}-${row.hour}`);
      }
    }

    const bookedSlotSet = new Set<string>();
    for (const row of bookingsRes.data) {
      const hour = hourFromLabel(row.booking_time);
      if (hour !== null) bookedSlotSet.add(`${row.booking_date}-${hour}`);
    }

    const result: AvailabilityDay[] = [];
    for (let i = 0; i < daysAhead; i++) {
      const date = addDays(today, i);
      const dateStr = toISODateString(date);
      const dayKey = DAY_KEYS[date.getDay()];
      const sched = scheduleMap.get(dayKey);
      const isOpen = sched?.is_open ?? false;
      const isDayBlocked = blockedDaySet.has(dateStr);

      const slots: AvailabilitySlot[] = [];
      if (isOpen && sched) {
        for (let h = sched.start_hour; h < sched.end_hour; h++) {
          slots.push({
            hour: h,
            label: formatHourLabel(h),
            isBooked: bookedSlotSet.has(`${dateStr}-${h}`),
            isBlocked: blockedSlotSet.has(`${dateStr}-${h}`),
          });
        }
      }

      result.push({
        date, dayKey,
        dateLabel: `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`,
        fullLabel: `${dayKey}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`,
        isOpen, isDayBlocked, slots,
      });
    }

    setDays(result);
    setLoading(false);
  }, [daysAhead]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const blockDay = useCallback(async (date: Date) => {
    await assertAuthenticated();
    const { error: insertError } = await supabase.from("blocked_slots").insert({ date: toISODateString(date), hour: null });
    if (insertError) await handleWriteError(insertError);
    await fetchAvailability();
  }, [fetchAvailability]);

  const unblockDay = useCallback(async (date: Date) => {
    await assertAuthenticated();
    const { error: deleteError } = await supabase.from("blocked_slots").delete().eq("date", toISODateString(date)).is("hour", null);
    if (deleteError) await handleWriteError(deleteError);
    await fetchAvailability();
  }, [fetchAvailability]);

  const blockSlot = useCallback(async (date: Date, hour: number) => {
    await assertAuthenticated();
    const { error: insertError } = await supabase.from("blocked_slots").insert({ date: toISODateString(date), hour });
    if (insertError) await handleWriteError(insertError);
    await fetchAvailability();
  }, [fetchAvailability]);

  const unblockSlot = useCallback(async (date: Date, hour: number) => {
    await assertAuthenticated();
    const { error: deleteError } = await supabase.from("blocked_slots").delete().eq("date", toISODateString(date)).eq("hour", hour);
    if (deleteError) await handleWriteError(deleteError);
    await fetchAvailability();
  }, [fetchAvailability]);

  const openDay = useCallback(async (dayKey: string, startHour: number, endHour: number) => {
    await assertAuthenticated();
    const { error: updateError } = await supabase.from("schedule_defaults")
      .update({ is_open: true, start_hour: startHour, end_hour: endHour }).eq("day_key", dayKey);
    if (updateError) await handleWriteError(updateError);
    await fetchAvailability();
  }, [fetchAvailability]);

  const closeDay = useCallback(async (dayKey: string) => {
    await assertAuthenticated();
    const { error: updateError } = await supabase.from("schedule_defaults")
      .update({ is_open: false }).eq("day_key", dayKey);
    if (updateError) await handleWriteError(updateError);
    await fetchAvailability();
  }, [fetchAvailability]);

  const bookingDays: BookingDay[] = days
    .filter(d => d.isOpen && !d.isDayBlocked)
    .map(d => {
      const available = d.slots.filter(s => !s.isBooked && !s.isBlocked);
      return {
        key: d.dayKey, label: d.fullLabel, date: toISODateString(d.date),
        slots: available.map(s => s.label), slotCount: available.length,
      };
    })
    .filter(d => d.slotCount > 0);

  return { days, bookingDays, loading, error, refetch: fetchAvailability, blockDay, unblockDay, blockSlot, unblockSlot, openDay, closeDay };
}
