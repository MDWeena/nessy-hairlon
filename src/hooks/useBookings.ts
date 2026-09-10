import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import type { Order, OrderStatus } from "../types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

interface NotificationBookingPayload {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string;
  booking_date: string;
  booking_time: string;
  status: OrderStatus;
  quoted_price: number | null;
}

async function notify(body: { type: "new_booking"; booking: NotificationBookingPayload } | { type: "status_change"; booking: NotificationBookingPayload; previousStatus: OrderStatus }) {
  try {
    await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Notification failures shouldn't block the booking/status update itself.
  }
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
  };
}

interface UseBookingsResult {
  bookings: Order[];
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
    const existing = rows.find(r => r.id === id);
    const { error: updateError } = await supabase.from("bookings")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw new Error(updateError.message);

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
    }
    await fetchBookings();
  }, [rows, fetchBookings]);

  const setQuotedPrice = useCallback(async (id: string, price: number) => {
    const existing = rows.find(r => r.id === id);
    const { error: updateError } = await supabase.from("bookings")
      .update({ quoted_price: price, status: "quoted", updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw new Error(updateError.message);

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
  customStyleDescription?: string | null;
}

/** Inserts a new booking (client-facing) and best-effort notifies the admin by email. */
export async function createBooking(input: CreateBookingInput): Promise<void> {
  const { data, error } = await supabase.from("bookings").insert({
    client_name: input.clientName,
    client_phone: input.clientPhone,
    client_email: input.clientEmail ?? null,
    booking_date: input.bookingDate,
    booking_time: input.bookingTime,
    service_ids: input.serviceIds,
    custom_style_description: input.customStyleDescription ?? null,
  }).select().single();

  if (error) throw new Error(error.message);

  await notify({
    type: "new_booking",
    booking: {
      id: data.id, client_name: data.client_name, client_email: data.client_email,
      client_phone: data.client_phone, booking_date: data.booking_date, booking_time: data.booking_time,
      status: data.status, quoted_price: data.quoted_price,
    },
  });
}
