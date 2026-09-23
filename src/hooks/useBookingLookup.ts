import { supabase } from "../lib/supabase";
import { shortBookingReference } from "../lib/bookingReference";
import { notify } from "../lib/notify";
import type { OrderStatus } from "../types";

export interface TrackedBooking {
  id: string;
  reference: string;
  clientName: string;
  date: string;
  time: string;
  status: OrderStatus;
  quotedPrice: number | null;
  serviceNames: string[];
  customStyleUrl: string | null;
  customStyleDescription: string | null;
}

export interface LookupBookingsQuery {
  reference?: string;
  phone?: string;
}

/**
 * Looks up a client's own booking(s) by reference code or phone number — no auth
 * required. Backed by the `lookup_bookings` Postgres function (SECURITY DEFINER,
 * exact-match only), not a direct table read, so this can never return every
 * booking regardless of what's passed in.
 */
export async function lookupBookings({ reference, phone }: LookupBookingsQuery): Promise<TrackedBooking[]> {
  const p_reference = reference?.trim() || null;
  const p_phone = phone?.trim() || null;
  if (!p_reference && !p_phone) return [];

  const { data, error } = await supabase.rpc("lookup_bookings", { p_reference, p_phone });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const serviceIds = Array.from(new Set(data.flatMap(row => row.service_ids)));
  let nameById = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: serviceRows } = await supabase.from("services").select("id, name").in("id", serviceIds);
    nameById = new Map((serviceRows ?? []).map(s => [s.id, s.name]));
  }

  return data.map(row => ({
    id: row.id,
    reference: shortBookingReference(row.id),
    clientName: row.client_name,
    date: row.booking_date,
    time: row.booking_time,
    status: row.status,
    quotedPrice: row.quoted_price,
    serviceNames: row.service_ids.map(id => nameById.get(id)).filter((n): n is string => Boolean(n)),
    customStyleUrl: row.custom_style_url,
    customStyleDescription: row.custom_style_description,
  }));
}

/**
 * Reschedules a booking from the (unauthenticated) Track Booking page. Backed
 * by the `reschedule_booking` SECURITY DEFINER function, which re-verifies
 * the reference + phone match server-side and enforces the 24h-notice rule
 * itself — this client-side call can't bypass either check. Best-effort
 * notifies the admin by email afterward.
 */
export async function rescheduleBooking(booking: TrackedBooking, phone: string, newDate: string, newTime: string): Promise<void> {
  const { error } = await supabase.rpc("reschedule_booking", {
    p_reference: booking.reference, p_phone: phone, p_new_date: newDate, p_new_time: newTime,
  });
  if (error) throw new Error(error.message);

  await notify({
    type: "client_reschedule",
    previousDate: booking.date,
    previousTime: booking.time,
    booking: {
      id: booking.id, client_name: booking.clientName, client_email: null, client_phone: phone,
      booking_date: newDate, booking_time: newTime, status: booking.status, quoted_price: booking.quotedPrice,
    },
  });
}

/** Cancels a booking from the Track Booking page. Same verification model as rescheduleBooking. */
export async function cancelBooking(booking: TrackedBooking, phone: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_booking", { p_reference: booking.reference, p_phone: phone });
  if (error) throw new Error(error.message);

  await notify({
    type: "client_cancellation",
    booking: {
      id: booking.id, client_name: booking.clientName, client_email: null, client_phone: phone,
      booking_date: booking.date, booking_time: booking.time, status: "cancelled", quoted_price: booking.quotedPrice,
    },
  });
}

/**
 * Submits a client review from the Leave a Review page. Backed by the
 * `submit_review` SECURITY DEFINER function — only allowed for completed
 * bookings, one review per booking, always inserted hidden (is_visible=false)
 * pending admin approval.
 */
export async function submitReview(reference: string, phone: string, stars: number, reviewText: string): Promise<void> {
  const { error } = await supabase.rpc("submit_review", {
    p_reference: reference, p_phone: phone, p_stars: stars, p_review_text: reviewText,
  });
  if (error) throw new Error(error.message);
}
