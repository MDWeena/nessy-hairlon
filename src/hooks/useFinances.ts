import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import { computeAll, type ExpenseCategory, type MonthFigures, type MonthSnapshot, type RateKind } from "../lib/finance";
import { generateInsights, type Insight } from "../lib/financeInsights";
import { TRACKING_START_KEY, toFinanceInput, type FinanceRows } from "../lib/financeData";
import type { Database } from "../types/database";

type Tables = Database["public"]["Tables"];

/** Set by the dashboard's "Your October report is ready" notice to open that month directly. */
export const OPEN_MONTH_KEY = "nessy_finances_open_month";

export interface ClosedReport {
  month: string;
  figures: Partial<MonthSnapshot>;
  insights: Insight[];
  closedAt: string;
}

export interface FinanceState {
  loading: boolean;
  error: string | null;
  rows: FinanceRows | null;
  months: MonthFigures[];
  totals: ReturnType<typeof computeAll>["totals"] | null;
  insightsByMonth: Map<string, Insight[]>;
  reports: Map<string, ClosedReport>;
  trackingStart: string | null;
  categoryCosts: Map<string, number>;
  refetch: () => Promise<void>;
  addExpense: (e: { date: string; category: ExpenseCategory; amount: number; note: string | null }) => Promise<void>;
  updateExpense: (id: string, e: { date: string; category: ExpenseCategory; amount: number; note: string | null }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addRecurring: (r: { category: ExpenseCategory; amount: number; note: string | null; startDate: string }) => Promise<void>;
  stopRecurring: (id: string, endDate: string) => Promise<void>;
  setRate: (kind: RateKind, amount: number, effectiveFrom: string) => Promise<void>;
  setTrackingStart: (date: string) => Promise<void>;
  setCategoryCost: (category: string, typicalCost: number) => Promise<void>;
  setProductCost: (bookingId: string, cost: number | null) => Promise<void>;
  recordRefund: (bookingId: string, amount: number) => Promise<void>;
}

async function check<T>(p: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) await handleWriteError(error);
  return data as T;
}

/** Everything the admin Finances page needs, recomputed live from the database. */
export function useFinances(): FinanceState {
  const [rows, setRows] = useState<FinanceRows | null>(null);
  const [reportRows, setReportRows] = useState<Tables["monthly_reports"]["Row"][]>([]);
  const [categoryRows, setCategoryRows] = useState<Tables["category_product_costs"]["Row"][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Fixed for the life of the page (keeps render pure); refetch() moves it forward.
  const [now, setNow] = useState(() => Date.now());

  const refetch = useCallback(async () => {
    const [bookings, services, payments, rates, expenses, recurring, config, reports, cats, pct] = await Promise.all([
      supabase.from("bookings").select("*"),
      supabase.from("services").select("id, category"),
      supabase.from("payments").select("*"),
      supabase.from("cost_rates").select("*"),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("recurring_expenses").select("*").order("start_date", { ascending: false }),
      supabase.from("finance_config").select("*"),
      supabase.from("monthly_reports").select("*"),
      supabase.from("category_product_costs").select("*"),
      supabase.from("settings").select("value").eq("key", "deposit_percentage").maybeSingle(),
    ]);
    const failed = [bookings, services, payments, rates, expenses, recurring, config, reports, cats].find(r => r.error);
    if (failed?.error) {
      console.error("useFinances: load failed", failed.error);
      setError("Couldn't load the finance data. Please refresh and try again.");
      setLoading(false);
      return;
    }
    const pctValue = Number(pct.data?.value);
    setRows({
      bookings: bookings.data ?? [], services: services.data ?? [], payments: payments.data ?? [], rates: rates.data ?? [],
      expenses: expenses.data ?? [], recurring: recurring.data ?? [], config: config.data ?? [],
      depositPercentage: Number.isFinite(pctValue) && pct.data ? pctValue : 50,
    });
    setError(null);
    setReportRows(reports.data ?? []);
    setCategoryRows(cats.data ?? []);
    setNow(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const computed = useMemo(() => {
    if (!rows) return null;
    const input = toFinanceInput(rows, now);
    const all = computeAll(input);
    const insightsByMonth = new Map<string, Insight[]>();
    all.months.forEach((m, i) => insightsByMonth.set(m.month, generateInsights(m, i > 0 ? all.months[i - 1] : null)));
    return { ...all, insightsByMonth, trackingStart: input.trackingStart };
  }, [rows, now]);

  const reports = useMemo(() => new Map(reportRows.map(r => [r.month.slice(0, 7), {
    month: r.month.slice(0, 7), figures: (r.figures ?? {}) as Partial<MonthSnapshot>, insights: (r.insights ?? []) as unknown as Insight[], closedAt: r.closed_at,
  }])), [reportRows]);

  const write = useCallback(async (fn: () => Promise<unknown>) => {
    await assertAuthenticated();
    await fn();
    await refetch();
  }, [refetch]);

  return {
    loading, error, rows,
    months: computed?.months ?? [], totals: computed?.totals ?? null,
    insightsByMonth: computed?.insightsByMonth ?? new Map(), reports,
    trackingStart: computed?.trackingStart ?? null,
    categoryCosts: new Map(categoryRows.map(c => [c.category, c.typical_cost])),
    refetch,
    addExpense: (e) => write(() => check(supabase.from("expenses").insert({ expense_date: e.date, category: e.category, amount: e.amount, note: e.note }))),
    updateExpense: (id, e) => write(() => check(supabase.from("expenses").update({ expense_date: e.date, category: e.category, amount: e.amount, note: e.note }).eq("id", id))),
    deleteExpense: (id) => write(() => check(supabase.from("expenses").delete().eq("id", id))),
    addRecurring: (r) => write(() => check(supabase.from("recurring_expenses").insert({ category: r.category, amount: r.amount, note: r.note, start_date: r.startDate }))),
    stopRecurring: (id, endDate) => write(() => check(supabase.from("recurring_expenses").update({ end_date: endDate }).eq("id", id))),
    // A new rate from a date: past months keep the rate they had (rule 6).
    setRate: (kind, amount, effectiveFrom) => write(() => check(supabase.from("cost_rates").upsert({ kind, amount, effective_from: effectiveFrom }, { onConflict: "kind,effective_from" }))),
    setTrackingStart: (date) => write(() => check(supabase.from("finance_config").upsert({ key: TRACKING_START_KEY, value: date, updated_at: new Date().toISOString() }))),
    setCategoryCost: (category, typicalCost) => write(() => check(supabase.from("category_product_costs").upsert({ category, typical_cost: typicalCost, updated_at: new Date().toISOString() }))),
    setProductCost: (bookingId, cost) => write(() => check(supabase.from("bookings").update({ product_cost: cost }).eq("id", bookingId))),
    recordRefund: (bookingId, amount) => write(() => check(supabase.from("payments").insert({ booking_id: bookingId, kind: "refund", amount, note: "Deposit refunded on cancellation" }))),
  };
}

/** Typical product cost per service category, for prefilling the quote field. */
export function useCategoryProductCosts(): Map<string, number> {
  const [rows, setRows] = useState<Tables["category_product_costs"]["Row"][]>([]);
  useEffect(() => {
    supabase.from("category_product_costs").select("*").then(({ data }) => setRows(data ?? []));
  }, []);
  return useMemo(() => new Map(rows.map(r => [r.category, r.typical_cost])), [rows]);
}
