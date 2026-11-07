import type { Database } from "../types/database.js";
import type { OrderStatus } from "../types/index.js";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type FinBooking, type FinanceInput, type LedgerPayment, type RateEntry, type RecurringExpense } from "./finance.js";

/**
 * Turns database rows into FinanceInput — shared by the admin Finances page (src/hooks/
 * useFinances.ts) and the month-close cron (api/close-month.ts), so both compute from exactly
 * the same mapping.
 */
type Tables = Database["public"]["Tables"];
export type BookingRow = Tables["bookings"]["Row"];
type ServiceRow = Pick<Tables["services"]["Row"], "id" | "category">;

export interface FinanceRows {
  bookings: BookingRow[];
  services: ServiceRow[];
  payments: Tables["payments"]["Row"][];
  rates: Tables["cost_rates"]["Row"][];
  expenses: Tables["expenses"]["Row"][];
  recurring: Tables["recurring_expenses"]["Row"][];
  config: Tables["finance_config"]["Row"][];
  depositPercentage: number | null;
}

const CUSTOM = "Custom style";

/** A booking's category for the insights: its first service's category, else the category the
 * admin chose when quoting a custom style, else "Custom style". */
export function bookingCategory(b: Pick<BookingRow, "service_ids" | "custom_style_category">, categoryByService: Map<string, string>): string {
  for (const id of b.service_ids ?? []) {
    const c = categoryByService.get(id);
    if (c) return c;
  }
  return b.custom_style_category || CUSTOM;
}

const items = (x: unknown) => ((x ?? []) as { quantity: number; unit_cost: number }[]).map(i => ({ quantity: Number(i.quantity) || 0, unitCost: Number(i.unit_cost) || 0 }));

export function toFinBooking(b: BookingRow, categoryByService: Map<string, string>): FinBooking {
  return {
    id: b.id, clientName: b.client_name, date: b.booking_date, time: b.booking_time, status: b.status as OrderStatus,
    quotedPrice: b.quoted_price, attachmentPreference: b.attachment_preference,
    attachmentItems: items(b.attachment_items), accessoryItems: items(b.accessory_items),
    hairServiceCost: b.hair_service_cost === null || b.hair_service_cost === undefined ? null : Number(b.hair_service_cost),
    depositConfirmedAt: b.deposit_confirmed_at, balancePaidAt: b.balance_paid_at,
    productCost: b.product_cost ?? null, category: bookingCategory(b, categoryByService),
  };
}

function asCategory(c: string): ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(c) ? (c as ExpenseCategory) : "Other";
}

export const TRACKING_START_KEY = "tracking_start_date";

export function trackingStartFrom(config: Tables["finance_config"]["Row"][], bookings: BookingRow[]): string {
  const v = config.find(c => c.key === TRACKING_START_KEY)?.value;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Fallback (config row missing): the Lagos date of the first booking made.
  const first = bookings.map(b => b.created_at).sort()[0];
  return first ? new Date(Date.parse(first) + 3600_000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export function toFinanceInput(rows: FinanceRows, now: number): FinanceInput {
  const categoryByService = new Map(rows.services.map(s => [s.id, s.category]));
  return {
    bookings: rows.bookings.map(b => toFinBooking(b, categoryByService)),
    payments: rows.payments.map((p): LedgerPayment => ({ bookingId: p.booking_id, kind: p.kind, amount: p.amount, receivedAt: p.received_at, source: p.source })),
    rates: rows.rates.map((r): RateEntry => ({ kind: r.kind, amount: r.amount, effectiveFrom: r.effective_from })),
    expenses: rows.expenses.map((e): Expense => ({ id: e.id, date: e.expense_date, category: asCategory(e.category), amount: e.amount, note: e.note })),
    recurring: rows.recurring.map((r): RecurringExpense => ({ id: r.id, category: asCategory(r.category), amount: r.amount, note: r.note, startDate: r.start_date, endDate: r.end_date })),
    trackingStart: trackingStartFrom(rows.config, rows.bookings),
    depositPercentage: rows.depositPercentage,
    now,
  };
}
