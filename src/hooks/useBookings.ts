import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import { getMonthRange, getWeekRange } from "../lib/date";
import { notify } from "../lib/notify";
import { hourFromLabel } from "./useAvailability";
import type { Database } from "../types/database";
import type { Order, OrderStatus } from "../types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

export interface BookingStats {
  thisWeekCount: number;
  pendingReviewCount: number;
  revenueThisWeek: number;
  clientsThisMonthCount: number;
}

function computeStats(rows: BookingRow[]): BookingStats {
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange(now);
  const { start: monthStart, end: monthEnd } = getMonthRange(now);

  const thisWeekRows = rows.filter(r => r.booking_date >= weekStart && r.booking_date <= weekEnd);
  const thisMonthRows = rows.filter(r => r.booking_date >= monthStart && r.booking_date <= monthEnd);

  return {
    thisWeekCount: thisWeekRows.length,
    pendingReviewCount: rows.filter(r => r.status === "pending_review").length,
    revenueThisWeek: thisWeekRows
      .filter(r => r.status === "confirmed" || r.status === "completed")
      .reduce((sum, r) => sum + (r.quoted_price ?? 0), 0),
    clientsThisMonthCount: new Set(thisMonthRows.map(r => r.client_phone)).size,
  };
}

/**
 * Creates the "24h before" and "2h before" reminder rows for a just-confirmed
 * booking, so api/process-reminders.ts has something to send. Reminders whose
 * time has already passed (e.g. confirming a booking a few hours out) are
 * simply skipped rather than inserted with a scheduled_for in the past.
 */
async function scheduleReminders(booking: { id: string; booking_date: string; booking_time: string }) {
  const hour = hourFromLabel(booking.booking_time);
  if (hour === null) return;

  const appointment = new Date(`${booking.booking_date}T00:00:00`);
  appointment.setHours(hour, 0, 0, 0);

  const rows = [
    { reminder_type: "24h_before" as const, offsetMs: 24 * 60 * 60 * 1000 },
    { reminder_type: "2h_before" as const, offsetMs: 2 * 60 * 60 * 1000 },
  ]
    .map(r => ({ reminder_type: r.reminder_type, scheduled_for: new Date(appointment.getTime() - r.offsetMs) }))
    .filter(r => r.scheduled_for.getTime() > Date.now())
    .map(r => ({ booking_id: booking.id, reminder_type: r.reminder_type, scheduled_for: r.scheduled_for.toISOString() }));

  if (rows.length === 0) return;
  await supabase.from("booking_reminders").insert(rows);
}

function describeBookingService(row: BookingRow, nameById: Map<string, string>): string {
  const names = row.service_ids.map(id => nameById.get(id)).filter((n): n is string => Boolean(n));
  if (row.custom_style_url) {
    return names.length ? `${names.join(", ")} (custom)` : "Custom style (photo uploaded)";
  }
  return names.length ? names.join(", ") : "—";
}

function rowToOrder(row: BookingRow, nameById: Map<string, string>): Order {
  return {
    id: row.id,
    client: row.client_name,
    service: describeBookingService(row, nameById),
    date: row.booking_date,
    time: row.booking_time,
    status: row.status,
    price: row.quoted_price != null ? `₦${row.quoted_price.toLocaleString()}` : null,
    customStyleUrl: row.custom_style_url,
    customStyleDescription: row.custom_style_description,
  };
}

interface UseBookingsResult {
  bookings: Order[];
  stats: BookingStats;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateBookingStatus: (id: string, status: OrderStatus) => Promise<void>;
  setQuotedPrice: (id: string, price: number) => Promise<void>;
}

export function useBookings(): UseBookingsResult {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [bookingsRes, servicesRes] = await Promise.all([
      supabase.from("bookings").select("*")
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true }),
      supabase.from("services").select("id, name"),
    ]);

    if (bookingsRes.error) { setError(bookingsRes.error.message); setLoading(false); return; }
    if (servicesRes.error) { setError(servicesRes.error.message); setLoading(false); return; }

    setNameById(new Map(servicesRes.data.map(s => [s.id, s.name])));
    setRows(bookingsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const updateBookingStatus = useCallback(async (id: string, status: OrderStatus) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const { error: updateError } = await supabase.from("bookings")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) await handleWriteError(updateError);

    if (existing) {
      await notify({
        type: "status_change",
        previousStatus: existing.status,
        booking: {
          id: existing.id, client_name: existing.client_name, client_email: existing.client_email,
          client_phone: existing.client_phone, booking_date: existing.booking_date, booking_time: existing.booking_time,
          status, quoted_price: existing.quoted_price,
        },
      });
      if (status === "confirmed" && existing.status !== "confirmed") {
        await scheduleReminders(existing);
      }
    }
    await fetchBookings();
  }, [rows, fetchBookings]);

  const setQuotedPrice = useCallback(async (id: string, price: number) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const { error: updateError } = await supabase.from("bookings")
      .update({ quoted_price: price, status: "quoted", updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) await handleWriteError(updateError);

    if (existing) {
      await notify({
        type: "status_change",
        previousStatus: existing.status,
        booking: {
          id: existing.id, client_name: existing.client_name, client_email: existing.client_email,
          client_phone: existing.client_phone, booking_date: existing.booking_date, booking_time: existing.booking_time,
          status: "quoted", quoted_price: price,
        },
      });
    }
    await fetchBookings();
  }, [rows, fetchBookings]);

  return {
    bookings: rows.map(r => rowToOrder(r, nameById)),
    stats: computeStats(rows),
    loading, error, refetch: fetchBookings, updateBookingStatus, setQuotedPrice,
  };
}

export interface CreateBookingInput {
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  bookingDate: string;
  bookingTime: string;
  serviceIds: string[];
  customStyleUrl?: string | null;
  customStyleDescription?: string | null;
}

/**
 * Inserts a new booking (client-facing) and best-effort notifies the admin by email.
 * Returns the new booking's id (for the reference code shown on the success screen).
 *
 * Generates the row's id client-side and skips `.select()` so this never asks Postgres
 * to read the row back — anon has no SELECT policy on `bookings` (it contains client
 * PII), only INSERT, so an insert-then-select-back would fail the RETURNING visibility
 * check even though the insert itself succeeded.
 */
export async function createBooking(input: CreateBookingInput): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("bookings").insert({
    id,
    client_name: input.clientName,
    client_phone: input.clientPhone,
    client_email: input.clientEmail ?? null,
    booking_date: input.bookingDate,
    booking_time: input.bookingTime,
    service_ids: input.serviceIds,
    custom_style_url: input.customStyleUrl ?? null,
    custom_style_description: input.customStyleDescription ?? null,
  });

  if (error) throw new Error(error.message);

  await notify({
    type: "new_booking",
    booking: {
      id, client_name: input.clientName, client_email: input.clientEmail ?? null,
      client_phone: input.clientPhone, booking_date: input.bookingDate, booking_time: input.bookingTime,
      status: "pending_review", quoted_price: null,
    },
  });

  return id;
}
