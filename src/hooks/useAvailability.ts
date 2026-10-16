import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import { addDays, toISODateString } from "../lib/date";
import { computeAvailability, toBookingDays } from "../lib/availability";
import type { AvailabilityDay, BlockedSlotRow, BookedSlotRow, ScheduleDefaultRow } from "../lib/availability";
import type { BookingDay } from "../types";
import type { Database } from "../types/database";

export { formatHourLabel, hourFromLabel } from "../lib/availability";
export type { AvailabilityDay, AvailabilitySlot } from "../lib/availability";

export interface UseAvailabilityOptions {
  /** The booking being rescheduled — see ComputeAvailabilityInput.exclude. */
  exclude?: { date: string; time: string } | null;
  ignoreNotice?: boolean;
}

interface RawAvailability {
  today: Date;
  now: number;
  noticeHours: number;
  schedule: ScheduleDefaultRow[];
  blocked: BlockedSlotRow[];
  bookings: BookedSlotRow[];
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

export function useAvailability(daysAhead: number = 14, options: UseAvailabilityOptions = {}): UseAvailabilityResult {
  const [raw, setRaw] = useState<RawAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);

    const today = new Date();
    const rangeStart = toISODateString(today);
    const rangeEnd = toISODateString(addDays(today, daysAhead - 1));
    const now = Date.now();

    const [scheduleRes, blockedRes, bookingsRes, settingsRes] = await Promise.all([
      supabase.from("schedule_defaults").select("*"),
      supabase.from("blocked_slots").select("*").gte("date", rangeStart).lte("date", rangeEnd),
      // public_booking_slots exposes only booking_date/booking_time/status (no client PII),
      // so this works for anon (client booking flow) and authenticated (admin) alike.
      supabase.from("public_booking_slots").select("booking_date, booking_time, status")
        .gte("booking_date", rangeStart).lte("booking_date", rangeEnd),
      supabase.from("settings").select("value").eq("key", "min_booking_notice_hours").maybeSingle(),
    ]);

    if (scheduleRes.error) { setError(scheduleRes.error.message); setLoading(false); return; }
    if (blockedRes.error) { setError(blockedRes.error.message); setLoading(false); return; }
    if (bookingsRes.error) { setError(bookingsRes.error.message); setLoading(false); return; }

    // BUG FIX (pre-launch audit): settingsRes.error was never checked, so a failed fetch of
    // this one setting silently fell back to `?? 0`, disabling the minimum-notice requirement
    // entirely with no indication anything went wrong. Logged, and defaults to the original
    // seed value (24h, see supabase/migrations/001_initial_schema.sql) instead of 0 — erring
    // toward requiring more notice rather than none if this fetch fails.
    if (settingsRes.error) console.error("useAvailability: failed to load min_booking_notice_hours", settingsRes.error);
    const noticeHours = settingsRes.error ? 24 : (Number(settingsRes.data?.value ?? 0) || 0);

    setRaw({
      today, now, noticeHours,
      schedule: scheduleRes.data, blocked: blockedRes.data, bookings: bookingsRes.data,
    });
    setLoading(false);
  }, [daysAhead]);

  // Computed separately from the fetch (and keyed on primitives, not the options object)
  // so a caller passing a fresh `exclude` object every render doesn't trigger a refetch loop.
  const excludeDate = options.exclude?.date ?? null;
  const excludeTime = options.exclude?.time ?? null;
  const ignoreNotice = options.ignoreNotice ?? false;
  const days = useMemo<AvailabilityDay[]>(() => {
    if (!raw) return [];
    return computeAvailability({
      ...raw, daysAhead, ignoreNotice,
      exclude: excludeDate && excludeTime ? { date: excludeDate, time: excludeTime } : null,
    });
  }, [raw, daysAhead, excludeDate, excludeTime, ignoreNotice]);

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

  const bookingDays: BookingDay[] = useMemo(() => toBookingDays(days), [days]);

  return { days, bookingDays, loading, error, refetch: fetchAvailability, blockDay, unblockDay, blockSlot, unblockSlot, openDay, closeDay };
}

export interface ScheduleRule {
  maxSlotsPerDay: number;
  minGapHours: number;
}

interface UseScheduleRulesResult {
  weekday: ScheduleRule | null;
  sunday: ScheduleRule | null;
  loading: boolean;
  error: string | null;
  updateWeekday: (rule: ScheduleRule) => Promise<void>;
  updateSunday: (rule: ScheduleRule) => Promise<void>;
}

const WEEKDAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Lightweight counterpart to useAvailability for the admin Settings page — reads/writes
 * only the per-day capacity rules (max_slots_per_day, min_gap_hours) on schedule_defaults,
 * without pulling in the full multi-week slot computation.
 */
export function useScheduleRules(): UseScheduleRulesResult {
  const [rows, setRows] = useState<Database["public"]["Tables"]["schedule_defaults"]["Row"][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from("schedule_defaults").select("*");
    if (fetchError) { setError(fetchError.message); setLoading(false); return; }
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const updateWeekday = useCallback(async (rule: ScheduleRule) => {
    await assertAuthenticated();
    const { error: updateError } = await supabase.from("schedule_defaults")
      .update({ max_slots_per_day: rule.maxSlotsPerDay, min_gap_hours: rule.minGapHours })
      .in("day_key", WEEKDAY_KEYS);
    if (updateError) await handleWriteError(updateError);
    await fetchRules();
  }, [fetchRules]);

  const updateSunday = useCallback(async (rule: ScheduleRule) => {
    await assertAuthenticated();
    const { error: updateError } = await supabase.from("schedule_defaults")
      .update({ max_slots_per_day: rule.maxSlotsPerDay, min_gap_hours: rule.minGapHours })
      .eq("day_key", "Sun");
    if (updateError) await handleWriteError(updateError);
    await fetchRules();
  }, [fetchRules]);

  const weekdayRow = rows.find(r => WEEKDAY_KEYS.includes(r.day_key));
  const sundayRow = rows.find(r => r.day_key === "Sun");

  return {
    weekday: weekdayRow ? { maxSlotsPerDay: weekdayRow.max_slots_per_day, minGapHours: weekdayRow.min_gap_hours } : null,
    sunday: sundayRow ? { maxSlotsPerDay: sundayRow.max_slots_per_day, minGapHours: sundayRow.min_gap_hours } : null,
    loading, error, updateWeekday, updateSunday,
  };
}
