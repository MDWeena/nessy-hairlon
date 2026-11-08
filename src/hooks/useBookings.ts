import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import { getMonthRange, getWeekRange } from "../lib/date";
import { notify, type NotifyResult } from "../lib/notify";
import { FriendlyError, SLOT_TAKEN_MESSAGE } from "../lib/clientErrors";
import { calculateDepositAmount, calculateBalanceAmount, sumMaterials } from "../lib/payments";
import { isTrustedStyleReferenceUrl } from "../lib/validation";
import { UNTRUSTED_STYLE_REFERENCE_URL_MESSAGE } from "../constants/trustedDomains";
import { buildReminderRows } from "../lib/reminders";
import { useSettings } from "./useSettings";
import type { Database } from "../types/database";
import type { AttachmentPreference, MaterialItem, Order, OrderStatus } from "../types";

export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

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

/**
 * Records a payment in the ledger (024) with the amount AT THIS MOMENT, so a later price edit
 * can't rewrite history. One deposit / one balance per booking (re-confirming is a no-op).
 * The booking change itself has already saved; if only this fails, say so plainly.
 */
async function recordPayment(bookingId: string, kind: "deposit" | "balance", amount: number | null): Promise<void> {
  if (!amount || amount <= 0) return;
  const { error } = await supabase.from("payments")
    .upsert({ booking_id: bookingId, kind, amount, received_at: new Date().toISOString(), source: "app" }, { onConflict: "booking_id,kind", ignoreDuplicates: true });
  if (error) {
    console.error(`recordPayment: couldn't record ${kind} for ${bookingId}`, error);
    throw new Error(`Saved — but the ${kind} couldn't be added to Finances. Please refresh and try again.`);
  }
}

export function computeStats(rows: BookingRow[], depositPercentage: number | null): BookingStats {
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
export function computeRevenueBreakdown(rows: BookingRow[], depositPercentage: number | null): RevenueBreakdown {
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
 * Creates the reminder rows for a just-confirmed booking, so api/process-reminders.ts has
 * something to send: a "day before" and a "morning of" email (see src/lib/reminders.ts).
 * BUG FIX: this used to compute "appointment − 24h / − 2h" in the BROWSER's timezone and the
 * processor sent anything past that instant — with a once-a-day cron, "tomorrow" emails landed on
 * the day itself and "in 2 hours" emails the day after. Rows now carry the WAT send day, and the
 * processor decides from the booking's current date anyway.
 */
async function scheduleReminders(booking: { id: string; booking_date: string; booking_time: string }) {
  const rows = buildReminderRows(booking, Date.now());
  if (rows.length === 0) return;
  await supabase.from("booking_reminders").insert(rows);
}

function describeBookingService(row: BookingRow, nameById: Map<string, string>): string {
  const names = row.service_ids.map(id => nameById.get(id)).filter((n): n is string => Boolean(n));
  const hasCustomReference = !!row.custom_style_url || row.style_reference_urls.length > 0;
  if (hasCustomReference) {
    return names.length ? `${names.join(", ")} (custom)` : "Custom style (reference provided)";
  }
  // No named service and no reference link: a custom style described in words (or uploaded).
  return names.length ? names.join(", ") : "Custom style";
}

/** Exported for usePaginatedOrders.ts, which fetches bookings directly (server-side filtered/
 * paginated) rather than through this hook's full-table fetch, but needs the same row shape. */
export function rowToOrder(row: BookingRow, nameById: Map<string, string>): Order {
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
    styleReferenceUrls: row.style_reference_urls,
    clientNotes: row.client_notes,
    customStyleCategory: row.custom_style_category,
    // ?? fallbacks: rows read before 022_booking_reschedules.sql is applied won't have these.
    clientRescheduleCount: row.client_reschedule_count ?? 0,
    lastRescheduledAt: row.last_rescheduled_at ?? null,
    serviceIds: row.service_ids ?? [],
    productCost: row.product_cost ?? null,
    productCostNote: row.product_cost_note ?? null,
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

/** Pulled out of setQuotedPrice so the shape of the DB update — in particular, that a given
 * custom-style category actually ends up in the payload — is directly unit-testable without
 * touching Supabase. */
export function buildQuotedPriceUpdate(
  price: number,
  materials?: { hairServiceCost: number; attachmentItems: MaterialItem[]; accessoryItems: MaterialItem[] },
  customStyleCategory?: string,
  productCost?: number | null,
): Database["public"]["Tables"]["bookings"]["Update"] {
  const updates: Database["public"]["Tables"]["bookings"]["Update"] = { quoted_price: price, status: "quoted", updated_at: new Date().toISOString() };
  if (materials) {
    updates.hair_service_cost = materials.hairServiceCost;
    updates.attachment_items = materials.attachmentItems.map(i => ({ type: i.type, quantity: i.quantity, unit_cost: i.unitCost }));
    updates.accessory_items = materials.accessoryItems.map(i => ({ type: i.type, quantity: i.quantity, unit_cost: i.unitCost }));
  }
  if (customStyleCategory) {
    updates.custom_style_category = customStyleCategory;
  }
  // Admin-only (024): the products she expects to use — private, never shown to the client.
  if (productCost !== undefined) updates.product_cost = productCost;
  return updates;
}

interface UseBookingsResult {
  bookings: Order[];
  stats: BookingStats;
  revenueBreakdown: RevenueBreakdown;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** These resolve with the notification email's outcome (null when no email was attempted),
   * so the caller can warn when the change saved but the email didn't go out. */
  updateBookingStatus: (id: string, status: OrderStatus, options?: { notifyClient?: boolean }) => Promise<NotifyResult | null>;
  /** confirmed → completed; the thank-you + review email (send-notification's "completed"
   * status_change) goes out only if `sendThankYou` and the client has an email. */
  markCompleted: (id: string, sendThankYou: boolean, productCost?: number | null) => Promise<NotifyResult | null>;
  /**
   * Completes a past "quoted" / "deposit_paid" booking without the deposit step. paidInFull records
   * the full price as the balance in the payments ledger, dated today; otherwise the booking is
   * completed with the balance still outstanding (collectable later with "Mark Balance Paid").
   */
  completeWithoutConfirming: (id: string, options: { paidInFull: boolean; sendThankYou: boolean; productCost?: number | null }) => Promise<NotifyResult | null>;
  /** Cancels a booking (e.g. a quoted appointment that never happened). No email to the client. */
  cancelBooking: (id: string) => Promise<void>;
  /** completed → confirmed, to undo a mistaken "Mark Completed". Never emails. */
  moveBackToConfirmed: (id: string) => Promise<void>;
  setQuotedPrice: (
    id: string,
    price: number,
    materials?: { hairServiceCost: number; attachmentItems: MaterialItem[]; accessoryItems: MaterialItem[] },
    customStyleCategory?: string,
    productCost?: number | null,
  ) => Promise<NotifyResult | null>;
  confirmDepositPayment: (id: string) => Promise<NotifyResult | null>;
  rejectDepositPayment: (id: string) => Promise<NotifyResult | null>;
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

  const updateBookingStatus = useCallback(async (id: string, status: OrderStatus, options: { notifyClient?: boolean } = {}) => {
    const notifyClient = options.notifyClient ?? true;
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const { error: updateError } = await supabase.from("bookings")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) await handleWriteError(updateError);

    let notification: NotifyResult | null = null;
    if (existing) {
      if (notifyClient) notification = await notify({
        type: "status_change",
        previousStatus: existing.status,
        booking: {
          id: existing.id, client_name: existing.client_name, client_email: existing.client_email,
          client_phone: existing.client_phone, booking_date: existing.booking_date, booking_time: existing.booking_time,
          status, quoted_price: existing.quoted_price,
        },
      });
      // Reminders belong to a fresh confirmation, not to undoing "completed" by mistake.
      if (status === "confirmed" && existing.status !== "confirmed" && existing.status !== "completed") {
        await scheduleReminders(existing);
      }
    }
    await fetchBookings();
    return notification;
  }, [rows, fetchBookings]);

  const setQuotedPrice = useCallback(async (
    id: string,
    price: number,
    materials?: { hairServiceCost: number; attachmentItems: MaterialItem[]; accessoryItems: MaterialItem[] },
    customStyleCategory?: string,
    productCost?: number | null,
  ) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const updates = buildQuotedPriceUpdate(price, materials, customStyleCategory, productCost);
    const { error: updateError } = await supabase.from("bookings")
      .update(updates).eq("id", id);
    if (updateError) await handleWriteError(updateError);

    let notification: NotifyResult | null = null;
    if (existing) {
      notification = await notify({
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
    return notification;
  }, [rows, fetchBookings]);

  /** Admin verifies a client's "I've paid" claim: deposit_paid -> confirmed, records when, schedules reminders. */
  const confirmDepositPayment = useCallback(async (id: string) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase.from("bookings")
      .update({ status: "confirmed", deposit_confirmed_at: nowIso, updated_at: nowIso }).eq("id", id);
    if (updateError) await handleWriteError(updateError);
    if (existing) await recordPayment(id, "deposit", calculateDepositAmount(toDepositInput(existing), settings.deposit_percentage ?? null));

    let notification: NotifyResult | null = null;
    if (existing) {
      notification = await notify({
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
    return notification;
  }, [rows, fetchBookings, settings.deposit_percentage]);

  /** Admin can't find the deposit: deposit_paid -> quoted, asks the client to retry. */
  const rejectDepositPayment = useCallback(async (id: string) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const { error: updateError } = await supabase.from("bookings")
      .update({ status: "quoted", updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) await handleWriteError(updateError);

    let notification: NotifyResult | null = null;
    if (existing) {
      notification = await notify({
        type: "payment_not_verified",
        booking: {
          id: existing.id, client_name: existing.client_name, client_email: existing.client_email,
          client_phone: existing.client_phone, booking_date: existing.booking_date, booking_time: existing.booking_time,
          status: "quoted", quoted_price: existing.quoted_price,
        },
      });
    }
    await fetchBookings();
    return notification;
  }, [rows, fetchBookings]);

  /** Admin marks the remaining balance as collected — whether that was a deposit top-up or, for a booking confirmed without one, the full amount taken in person. */
  const markBalancePaid = useCallback(async (id: string) => {
    await assertAuthenticated();
    const existing = rows.find(r => r.id === id);
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase.from("bookings")
      .update({ balance_paid_at: nowIso, updated_at: nowIso }).eq("id", id);
    if (updateError) await handleWriteError(updateError);
    if (existing) {
      await recordPayment(id, "balance", calculateBalanceAmount(
        { ...toDepositInput(existing), depositConfirmedAt: existing.deposit_confirmed_at }, settings.deposit_percentage ?? null));
    }
    await fetchBookings();
  }, [rows, fetchBookings, settings.deposit_percentage]);

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
    // The server's own explanation: the Resend error on a failed send, or why it skipped.
    if (!body?.sent) throw new Error(body?.reason || body?.error || "Reminder was not sent");
    await fetchBookings();
  }, [fetchBookings]);

  const depositPercentage = settings.deposit_percentage ?? null;

  return {
    bookings: rows.map(r => rowToOrder(r, nameById)),
    stats: computeStats(rows, depositPercentage),
    revenueBreakdown: computeRevenueBreakdown(rows, depositPercentage),
    loading, error, refetch: fetchBookings, updateBookingStatus, setQuotedPrice,
    markCompleted: async (id: string, sendThankYou: boolean, productCost?: number | null) => {
      // What she actually used, adjustable at completion (admin-only, never shown to clients).
      if (productCost !== undefined) {
        const { error: pcError } = await supabase.from("bookings").update({ product_cost: productCost }).eq("id", id);
        if (pcError) await handleWriteError(pcError);
      }
      return updateBookingStatus(id, "completed", { notifyClient: sendThankYou });
    },
    completeWithoutConfirming: async (id: string, { paidInFull, sendThankYou, productCost }) => {
      await assertAuthenticated();
      const existing = rows.find(r => r.id === id);
      if (!existing || (existing.status !== "quoted" && existing.status !== "deposit_paid")) {
        throw new Error("This booking can't be completed this way any more. Please refresh.");
      }
      if (paidInFull && existing.quoted_price == null) throw new Error("Set a price first, so the payment can be recorded.");
      const nowIso = new Date().toISOString();
      const patch: { updated_at: string; product_cost?: number | null; balance_paid_at?: string } = { updated_at: nowIso };
      if (productCost !== undefined) patch.product_cost = productCost;
      // No deposit was confirmed, so the balance is the full price (calculateBalanceAmount agrees).
      if (paidInFull) patch.balance_paid_at = nowIso;
      const { error: patchError } = await supabase.from("bookings").update(patch).eq("id", id);
      if (patchError) await handleWriteError(patchError);
      if (paidInFull) {
        await recordPayment(id, "balance", calculateBalanceAmount(
          { ...toDepositInput(existing), depositConfirmedAt: null }, settings.deposit_percentage ?? null));
      }
      return updateBookingStatus(id, "completed", { notifyClient: sendThankYou });
    },
    cancelBooking: async (id: string) => { await updateBookingStatus(id, "cancelled", { notifyClient: false }); },
    moveBackToConfirmed: async (id: string) => { await updateBookingStatus(id, "confirmed", { notifyClient: false }); },
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
  styleReferenceUrls?: string[];
  clientNotes?: string | null;
  attachmentPreference?: AttachmentPreference | null;
}

/**
 * Creates a new booking (client-facing) through create_booking() and best-effort notifies the
 * admin by email. Returns the new booking's id (for the reference code on the success screen).
 * Known failures throw a FriendlyError; anything else is rethrown as-is for the UI to map with
 * toClientError() — raw database text is never shown to clients.
 */
export async function createBooking(input: CreateBookingInput): Promise<string> {
  // SECURITY FIX: style reference links used to be accepted as any well-formed URL — a client
  // could submit an arbitrary link an admin would then open while reviewing the booking. Also
  // enforced at the database level (supabase/migrations/021_trusted_style_reference_domains.sql)
  // since this check alone can be bypassed by calling the Supabase REST API directly.
  const urls = input.styleReferenceUrls ?? [];
  if (urls.some(url => !isTrustedStyleReferenceUrl(url))) {
    throw new FriendlyError(UNTRUSTED_STYLE_REFERENCE_URL_MESSAGE);
  }

  // create_booking (supabase/migrations/022_booking_reschedules.sql) takes a per-date lock and
  // re-runs the full availability check — capacity, minimum gap, blocked days/hours, opening
  // hours, notice — before inserting, so two clients submitting at the same moment can't
  // overfill a day or land inside each other's gap. The calendar's view can be minutes old.
  const { data: id, error } = await supabase.rpc("create_booking", {
    p_client_name: input.clientName,
    p_client_phone: input.clientPhone,
    p_client_email: input.clientEmail ?? null,
    p_booking_date: input.bookingDate,
    p_booking_time: input.bookingTime,
    p_service_ids: input.serviceIds,
    p_custom_style_url: input.customStyleUrl ?? null,
    p_custom_style_description: input.customStyleDescription ?? null,
    p_style_reference_urls: input.styleReferenceUrls ?? [],
    p_client_notes: input.clientNotes ?? null,
    p_attachment_preference: input.attachmentPreference ?? null,
  });

  if (error || !id) {
    if (!error) throw new FriendlyError("Booking could not be created. Please try again.", "unknown");
    // SLOT_UNAVAILABLE: the availability check failed under the lock — the slot (or the day)
    // filled up after this client loaded the calendar. 23505 = unique_violation from the
    // bookings_date_time_unique index (015_prevent_double_booking.sql), the last-line guard
    // for the exact same slot.
    if (error.message === "SLOT_UNAVAILABLE" || error.code === "23505") {
      throw new FriendlyError(SLOT_TAKEN_MESSAGE, "slot_taken");
    }
    if (error.message === "INVALID_REQUEST") {
      throw new FriendlyError("Please enter your name and phone number.");
    }
    // 23514 = check_violation — the style_reference_urls_trusted_domains constraint. The
    // client-side check above should always catch this first; this only fires if that check
    // and the DB's copy of the whitelist have drifted out of sync.
    if (error.code === "23514") {
      throw new FriendlyError(UNTRUSTED_STYLE_REFERENCE_URL_MESSAGE);
    }
    // Permission / row-level-security, a missing function, network trouble, anything else.
    throw error;
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
