import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import { getMonthRange, getWeekRange } from "../lib/date";
import { notify } from "../lib/notify";
import { calculateDepositAmount, calculateBalanceAmount, sumMaterials } from "../lib/payments";
import { hourFromLabel } from "./useAvailability";
import { useSettings } from "./useSettings";
import type { Database } from "../types/database";
import type { AttachmentPreference, MaterialItem, Order, OrderStatus } from "../types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

export interface BookingStats {
  thisWeekCount: number;
  pendingReviewCount: number;
  revenueThisWeek: number;
  depositsThisWeek: number;
  balanceCollectedThisWeek: number;
  clientsThisMonthCount: number;
}

export interface RevenueBreakdown {
  depositsReceived: number;
  balanceReceived: number;
  totalReceived: number;
  attachmentMaterialCosts: number;
  accessoryMaterialCosts: number;
}

/** bookings.attachment_items/accessory_items are stored snake_case (unit_cost); both the calc lib and the app-facing Order type expect camelCase. */
function toMaterialItems(items: { type: string; quantity: number; unit_cost: number }[] | null | undefined): MaterialItem[] {
  return (items ?? []).map(i => ({ type: i.type, quantity: i.quantity, unitCost: i.unit_cost }));
}

function toDepositInput(r: BookingRow) {
  return {
    quotedPrice: r.quoted_price,
    attachmentPreference: r.attachment_preference as AttachmentPreference | null,
    attachmentItems: toMaterialItems(r.attachment_items),
    accessoryItems: toMaterialItems(r.accessory_items),
    hairServiceCost: r.hair_service_cost,
  };
}

function computeStats(rows: BookingRow[], depositPercentage: number | null): BookingStats {
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange(now);
  const { start: monthStart, end: monthEnd } = getMonthRange(now);

  const thisWeekRows = rows.filter(r => r.booking_date >= weekStart && r.booking_date <= weekEnd);
  const thisMonthRows = rows.filter(r => r.booking_date >= monthStart && r.booking_date <= monthEnd);

  const moneyReceivedThisWeek = thisWeekRows.filter(r => r.status === "confirmed" || r.status === "completed");

  const depositsThisWeek = moneyReceivedThisWeek
    .filter(r => r.deposit_confirmed_at != null)
    .reduce((sum, r) => sum + (calculateDepositAmount(toDepositInput(r), depositPercentage) ?? 0), 0);
  const balanceCollectedThisWeek = moneyReceivedThisWeek
    .filter(r => r.balance_paid_at != null)
    .reduce((sum, r) => sum + (calculateBalanceAmount({ ...toDepositInput(r), depositConfirmedAt: r.deposit_confirmed_at }, depositPercentage) ?? 0), 0);

  return {
    thisWeekCount: thisWeekRows.length,
    pendingReviewCount: rows.filter(r => r.status === "pending_review" || r.status === "deposit_paid").length,
    // Actual money received, never the full quoted price unless fully paid.
    revenueThisWeek: depositsThisWeek + balanceCollectedThisWeek,
    depositsThisWeek,
    balanceCollectedThisWeek,
    clientsThisMonthCount: new Set(thisMonthRows.map(r => r.client_phone)).size,
  };
}

/**
 * All-time payments-received audit, independent of the weekly revenue stats above.
 * Deposits/balance are summed directly off deposit_confirmed_at/balance_paid_at
 * (not gated by current status — once money is confirmed received, it stays
 * counted even if the booking is later cancelled). Material costs are a separate
 * "where did the money go" view: the full attachment/accessory cost of a
 * nessy_buys booking is already covered as soon as its deposit is confirmed
 * (the deposit formula is full materials + 50% of the styling fee), so it's
 * counted in full the moment there's any payment at all, not split further.
 */
function computeRevenueBreakdown(rows: BookingRow[], depositPercentage: number | null): RevenueBreakdown {
  let depositsReceived = 0;
  let balanceReceived = 0;
  let attachmentMaterialCosts = 0;
  let accessoryMaterialCosts = 0;

  for (const r of rows) {
    const input = toDepositInput(r);

    if (r.deposit_confirmed_at != null) {
      depositsReceived += calculateDepositAmount(input, depositPercentage) ?? 0;
    }
    if (r.balance_paid_at != null) {
      balanceReceived += calculateBalanceAmount({ ...input, depositConfirmedAt: r.deposit_confirmed_at }, depositPercentage) ?? 0;
    }
    if (r.attachment_preference === "nessy_buys" && (r.deposit_confirmed_at != null || r.balance_paid_at != null)) {
      attachmentMaterialCosts += sumMaterials(input.attachmentItems);
      accessoryMaterialCosts += sumMaterials(input.accessoryItems);
    }
  }

  return {
    depositsReceived,
    balanceReceived,
    totalReceived: depositsReceived + balanceReceived,
    attachmentMaterialCosts,
    accessoryMaterialCosts,
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
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    service: describeBookingService(row, nameById),
    date: row.booking_date,
    time: row.booking_time,
    status: row.status,
    price: row.quoted_price != null ? `₦${row.quoted_price.toLocaleString()}` : null,
    quotedPrice: row.quoted_price,
    customStyleUrl: row.custom_style_url,
    customStyleDescription: row.custom_style_description,
    paymentProofUrl: row.payment_proof_url,
    attachmentPreference: (row.attachment_preference as AttachmentPreference) ?? null,
    attachmentItems: toMaterialItems(row.attachment_items),
    accessoryItems: toMaterialItems(row.accessory_items),
    hairServiceCost: row.hair_service_cost ?? null,
    depositConfirmedAt: row.deposit_confirmed_at,
    balancePaidAt: row.balance_paid_at,
    balanceReminderSentAt: row.balance_reminder_sent_at,
  };
}

interface UseBookingsResult {
  bookings: Order[];
  stats: BookingStats;
  revenueBreakdown: RevenueBreakdown;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateBookingStatus: (id: string, status: OrderStatus) => Promise<void>;
  setQuotedPrice: (
    id: string,
    price: number,
    materials?: { hairServiceCost: number; attachmentItems: MaterialItem[]; accessoryItems: MaterialItem[] },
  ) => Promise<void>;
  confirmDepositPayment: (id: string) => Promise<void>;
  rejectDepositPayment: (id: string) => Promise<void>;
  markBalancePaid: (id: string) => Promise<void>;
  sendBalanceReminder: (id: string) => Promise<void>;
}

export function useBookings(): UseBookingsResult {
  const { settings } = useSettings();
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

  const setQuotedPrice = useCallback(async (
    id: string,
    price: number,
    materials?: { hairServiceCost: number; attachmentItems: MaterialItem[]; accessoryItems: MaterialItem[] },
  ) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const updates: Database["public"]["Tables"]["bookings"]["Update"] = { quoted_price: price, status: "quoted", updated_at: new Date().toISOString() };
    if (materials) {
      updates.hair_service_cost = materials.hairServiceCost;
      updates.attachment_items = materials.attachmentItems.map(i => ({ type: i.type, quantity: i.quantity, unit_cost: i.unitCost }));
      updates.accessory_items = materials.accessoryItems.map(i => ({ type: i.type, quantity: i.quantity, unit_cost: i.unitCost }));
    }
    const { error: updateError } = await supabase.from("bookings")
      .update(updates).eq("id", id);
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

  /** Admin verifies a client's "I've paid" claim: deposit_paid -> confirmed, records when, schedules reminders. */
  const confirmDepositPayment = useCallback(async (id: string) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase.from("bookings")
      .update({ status: "confirmed", deposit_confirmed_at: nowIso, updated_at: nowIso }).eq("id", id);
    if (updateError) await handleWriteError(updateError);

    if (existing) {
      await notify({
        type: "status_change",
        previousStatus: existing.status,
        booking: {
          id: existing.id, client_name: existing.client_name, client_email: existing.client_email,
          client_phone: existing.client_phone, booking_date: existing.booking_date, booking_time: existing.booking_time,
          status: "confirmed", quoted_price: existing.quoted_price,
        },
      });
      if (existing.status !== "confirmed") await scheduleReminders(existing);
    }
    await fetchBookings();
  }, [rows, fetchBookings]);

  /** Admin can't find the deposit: deposit_paid -> quoted, asks the client to retry. */
  const rejectDepositPayment = useCallback(async (id: string) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const { error: updateError } = await supabase.from("bookings")
      .update({ status: "quoted", updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) await handleWriteError(updateError);

    if (existing) {
      await notify({
        type: "payment_not_verified",
        booking: {
          id: existing.id, client_name: existing.client_name, client_email: existing.client_email,
          client_phone: existing.client_phone, booking_date: existing.booking_date, booking_time: existing.booking_time,
          status: "quoted", quoted_price: existing.quoted_price,
        },
      });
    }
    await fetchBookings();
  }, [rows, fetchBookings]);

  /** Admin marks the remaining balance as collected — whether that was a deposit top-up or, for a booking confirmed without one, the full amount taken in person. */
  const markBalancePaid = useCallback(async (id: string) => {
    await assertAuthenticated();
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase.from("bookings")
      .update({ balance_paid_at: nowIso, updated_at: nowIso }).eq("id", id);
    if (updateError) await handleWriteError(updateError);
    await fetchBookings();
  }, [fetchBookings]);

  /** Manually (re)sends the balance-due reminder email for one booking, via the same endpoint the daily cron uses. */
  const sendBalanceReminder = useCallback(async (id: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not signed in");

    const res = await fetch("/api/process-balance-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookingId: id }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error || "Failed to send reminder");
    if (!body?.sent) throw new Error("Reminder was not sent");
    await fetchBookings();
  }, [fetchBookings]);

  const depositPercentage = settings.deposit_percentage ?? null;

  return {
    bookings: rows.map(r => rowToOrder(r, nameById)),
    stats: computeStats(rows, depositPercentage),
    revenueBreakdown: computeRevenueBreakdown(rows, depositPercentage),
    loading, error, refetch: fetchBookings, updateBookingStatus, setQuotedPrice,
    confirmDepositPayment, rejectDepositPayment, markBalancePaid, sendBalanceReminder,
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
  attachmentPreference?: AttachmentPreference | null;
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
    attachment_preference: input.attachmentPreference ?? null,
  });

  if (error) {
    // 23505 = unique_violation, from the bookings_date_time_unique index (see
    // supabase/migrations/015_prevent_double_booking.sql) — someone else booked this
    // exact slot in the time between this client loading the calendar and submitting.
    if (error.code === "23505") {
      throw new Error("That time slot was just booked by someone else. Please pick another.");
    }
    throw new Error(error.message);
  }

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
