import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.js";
import { computeMonth, monthsToClose, previousMonth, snapshotOf, type MonthSnapshot } from "../../src/lib/finance.js";
import { generateInsights, type Insight } from "../../src/lib/financeInsights.js";
import { toFinanceInput, trackingStartConfirmed, type FinanceRows } from "../../src/lib/financeData.js";

export interface MonthReportRow {
  month: string; // "2026-10-01"
  figures: MonthSnapshot;
  insights: Insight[];
}

export interface MonthCloseRepo {
  load(): Promise<{ rows: FinanceRows; closedMonths: string[] }>;
  /** Inserts only if that month has no report yet (never overwrites a closed report). */
  insert(report: MonthReportRow): Promise<boolean>;
}

export interface MonthCloseResult {
  success: boolean;
  dryRun: boolean;
  ranAt: string;
  closed: { month: string; profit: number; insights: number }[];
  alreadyClosed: string[];
  /** Set when nothing was closed on purpose (e.g. the tracking start hasn't been chosen yet). */
  skipped?: string;
}

/**
 * Closes every finished month (Africa/Lagos) since the tracking start that has no report yet —
 * normally just last month, on the 1st; a missed run catches up the next day. Stores a snapshot
 * of the figures and that month's insights in monthly_reports. Idempotent.
 */
export async function closeMonths(repo: MonthCloseRepo, now: number, dryRun: boolean): Promise<MonthCloseResult> {
  const { rows, closedMonths } = await repo.load();
  // Never snapshot a month against a guessed start date: wait until the admin has chosen it.
  if (!trackingStartConfirmed(rows.config)) {
    return { success: true, dryRun, ranAt: new Date(now).toISOString(), closed: [], alreadyClosed: closedMonths, skipped: "Tracking start date not chosen yet (Settings → Business costs)" };
  }
  const input = toFinanceInput(rows, now);
  const due = monthsToClose(input, closedMonths);
  const closed: MonthCloseResult["closed"] = [];
  for (const month of due) {
    const figures = computeMonth(input, month);
    const prev = month > input.trackingStart.slice(0, 7) ? computeMonth(input, previousMonth(month)) : null;
    const insights = generateInsights(figures, prev);
    if (!dryRun) {
      const inserted = await repo.insert({ month: `${month}-01`, figures: snapshotOf(figures), insights });
      if (!inserted) continue;
    }
    closed.push({ month, profit: figures.profit, insights: insights.length });
  }
  return { success: true, dryRun, ranAt: new Date(now).toISOString(), closed, alreadyClosed: closedMonths };
}

export function supabaseMonthCloseRepo(db: SupabaseClient<Database>): MonthCloseRepo {
  const all = async <T>(q: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => {
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  };
  return {
    async load() {
      const [bookings, services, payments, rates, expenses, recurring, config, reports, pct] = await Promise.all([
        all(db.from("bookings").select("*")),
        all(db.from("services").select("id, category")),
        all(db.from("payments").select("*")),
        all(db.from("cost_rates").select("*")),
        all(db.from("expenses").select("*")),
        all(db.from("recurring_expenses").select("*")),
        all(db.from("finance_config").select("*")),
        all(db.from("monthly_reports").select("month")),
        db.from("settings").select("value").eq("key", "deposit_percentage").maybeSingle(),
      ]);
      const pctValue = Number(pct.data?.value);
      return {
        rows: { bookings, services, payments, rates, expenses, recurring, config, depositPercentage: Number.isFinite(pctValue) && pct.data ? pctValue : 50 },
        closedMonths: reports.map(r => r.month.slice(0, 7)),
      };
    },
    async insert(report) {
      const { data, error } = await db.from("monthly_reports")
        .upsert({ month: report.month, figures: report.figures as unknown as Database["public"]["Tables"]["monthly_reports"]["Insert"]["figures"], insights: report.insights as unknown as Database["public"]["Tables"]["monthly_reports"]["Insert"]["insights"] },
          { onConflict: "month", ignoreDuplicates: true })
        .select("month");
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  };
}
