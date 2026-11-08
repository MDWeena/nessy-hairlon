import { calculateBalanceAmount, calculateDepositAmount, sumMaterials, type MaterialItemLike } from "./payments.js";
import { watSlotInstant } from "./reschedule.js";
import { addDaysToDate, watDateOf } from "./reminders.js";
import type { OrderStatus } from "../types/index.js";

/**
 * The Finances module's accounting rules, in one pure module so the admin page, the dashboard
 * card and the 1st-of-the-month close (api/close-month.ts) all compute the same numbers.
 * Every date and month boundary is Africa/Lagos (UTC+1, no DST), independent of the host
 * timezone. Amounts are whole naira.
 *
 *  1. A booking belongs to the month of its APPOINTMENT (booking_date), not of any payment.
 *  2. Earned = the full agreed price (quoted_price — styling fee plus any Nessy-supplied
 *     materials, the same total the deposit/balance split comes from) of appointments that took
 *     place: status "completed", or "confirmed" with its start time already passed.
 *  3. Collected = payments received for those appointments; Outstanding = the rest.
 *  4. Kept deposits = deposits received on bookings later cancelled, minus any recorded refund,
 *     counted in the month of the original appointment.
 *  5. Costs: products used (bookings.product_cost), materials bought for clients (nessy_buys
 *     items), transport (one fare per distinct hair day), staff salary and other expenses
 *     (one-off and recurring). Salary and recurring expenses accrue per day, so the launch month
 *     and the current month count only the days that apply.
 *  6. Rates (salary, transport) are a history: the rate effective on a given day is the latest
 *     entry whose effective_from is on or before it — changing a rate never changes past months.
 */

// ─── Inputs ─────────────────────────────────────────────────────────────────────────────────

export interface FinBooking {
  id: string;
  clientName: string;
  date: string;
  time: string;
  status: OrderStatus;
  quotedPrice: number | null;
  attachmentPreference: "client_provides" | "nessy_buys" | null;
  attachmentItems: MaterialItemLike[];
  accessoryItems: MaterialItemLike[];
  hairServiceCost: number | null;
  depositConfirmedAt: string | null;
  balancePaidAt: string | null;
  productCost: number | null;
  /** Service category used for the per-category insights ("Braiding", "Custom style", …). */
  category: string;
}

export type PaymentKind = "deposit" | "balance" | "refund";

export interface LedgerPayment {
  bookingId: string;
  kind: PaymentKind;
  amount: number;
  receivedAt: string;
  source: "app" | "backfill";
}

export type RateKind = "staff_salary" | "transport_daily";

export interface RateEntry {
  kind: RateKind;
  amount: number;
  effectiveFrom: string;
}

export const EXPENSE_CATEGORIES = [
  "Equipment & tools", "Rent & utilities", "Data & phone", "Marketing & adverts", "Supplies (bulk)", "Training", "Other",
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
}

export interface RecurringExpense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
  startDate: string;
  /** Last day it applies (inclusive); null while it's still running. */
  endDate: string | null;
}

export interface FinanceInput {
  bookings: FinBooking[];
  payments: LedgerPayment[];
  rates: RateEntry[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  /** First day tracked ("live since"); nothing before it is counted. */
  trackingStart: string;
  depositPercentage: number | null;
  now: number;
}

// ─── Dates (Africa/Lagos) ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" for any date in October 2026. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthEnd(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** "October 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** "14 Oct" */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}

/** Every date from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysToDate(d, 1)) out.push(d);
  return out;
}

/** Monday of the week containing `date` (weeks run Mon–Sun). */
export function weekStartOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysToDate(date, dow === 0 ? -6 : 1 - dow);
}

export function formatNaira(amount: number): string {
  const n = Math.round(amount);
  return `${n < 0 ? "−" : ""}₦${Math.abs(n).toLocaleString("en-US")}`;
}

// ─── Rates, payments, earned ────────────────────────────────────────────────────────────────

/** The rate effective on `date`: the latest entry of that kind with effectiveFrom ≤ date. */
export function rateOn(rates: RateEntry[], kind: RateKind, date: string): number {
  let best: RateEntry | null = null;
  for (const r of rates) {
    if (r.kind !== kind || r.effectiveFrom > date) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best?.amount ?? 0;
}

function depositInput(b: FinBooking) {
  return {
    quotedPrice: b.quotedPrice, attachmentPreference: b.attachmentPreference,
    attachmentItems: b.attachmentItems, accessoryItems: b.accessoryItems, hairServiceCost: b.hairServiceCost,
  };
}

export interface ReceivedPayment {
  kind: PaymentKind;
  amount: number;
  receivedAt: string;
  /** "ledger" rows were recorded when the payment was confirmed; "derived" rows are rebuilt from
   * today's price because no ledger row exists (only for data older than the ledger). */
  origin: "ledger" | "backfill" | "derived";
}

/**
 * The payments received for a booking. Ledger rows are the record — the amount as confirmed at
 * the time, immune to later price edits. Only when a booking has no ledger rows at all does this
 * fall back to deriving deposit/balance from its timestamps and current price.
 */
export function paymentsFor(b: FinBooking, ledger: LedgerPayment[], depositPercentage: number | null): ReceivedPayment[] {
  const rows = ledger.filter(p => p.bookingId === b.id);
  if (rows.length > 0) {
    return rows.map(p => ({ kind: p.kind, amount: p.amount, receivedAt: p.receivedAt, origin: p.source === "backfill" ? "backfill" : "ledger" }));
  }
  const out: ReceivedPayment[] = [];
  if (b.depositConfirmedAt) {
    const amount = calculateDepositAmount(depositInput(b), depositPercentage);
    if (amount) out.push({ kind: "deposit", amount, receivedAt: b.depositConfirmedAt, origin: "derived" });
  }
  if (b.balancePaidAt) {
    const amount = calculateBalanceAmount({ ...depositInput(b), depositConfirmedAt: b.depositConfirmedAt }, depositPercentage);
    if (amount) out.push({ kind: "balance", amount, receivedAt: b.balancePaidAt, origin: "derived" });
  }
  return out;
}

/** Net money kept from a booking: deposits + balances − refunds. */
export function netReceived(payments: ReceivedPayment[]): number {
  return payments.reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount), 0);
}

function hasStarted(b: Pick<FinBooking, "date" | "time">, now: number): boolean {
  const start = watSlotInstant(b.date, b.time);
  return start !== null ? start <= now : b.date < watDateOf(now);
}

/** Rule 2: the appointment has happened (completed, or confirmed and its start time has passed). */
export function isEarned(b: FinBooking, now: number): boolean {
  if (b.status === "completed") return true;
  if (b.status !== "confirmed") return false;
  const start = watSlotInstant(b.date, b.time);
  return start !== null ? start <= now : b.date < watDateOf(now);
}

export function materialsCost(b: FinBooking): number {
  return b.attachmentPreference === "nessy_buys" ? sumMaterials(b.attachmentItems) + sumMaterials(b.accessoryItems) : 0;
}

// ─── Month figures ──────────────────────────────────────────────────────────────────────────

export interface UnpaidBooking { bookingId: string; clientName: string; date: string; price: number; paid: number; owed: number }
export interface KeptDeposit {
  bookingId: string; clientName: string; date: string; amount: number;
  /** "payment" when more than a deposit was paid (e.g. paid in full) before the cancellation. */
  kind: "deposit" | "payment";
}

/** A past appointment never moved on from "quoted" / "deposit_paid" — not counted as Earned. */
export interface StuckBooking { bookingId: string; clientName: string; date: string; time: string; status: "quoted" | "deposit_paid"; price: number | null }

/** "Kept deposit" / "Kept payment" for one kept item; the section title for a list of them. */
export function keptLabel(kinds: KeptDeposit["kind"][], plural = false): string {
  const has = new Set(kinds);
  if (has.size === 0 || (has.size === 1 && has.has("deposit"))) return plural ? "Kept deposits" : "Kept deposit";
  if (has.size === 1) return plural ? "Kept payments" : "Kept payment";
  return "Kept deposits & payments";
}

export interface CategoryFigures {
  category: string;
  bookings: number;
  revenue: number;
  products: number;
  materials: number;
  /** revenue − products − materials (before transport, salary and overheads). */
  profit: number;
  avgPrice: number;
  avgProfit: number;
  /** products ÷ revenue (0–1). */
  productShare: number;
  missingProductCost: number;
}

export interface WeekFigures {
  start: string;
  end: string;
  appointments: number;
  earned: number;
  products: number;
  materials: number;
  transport: number;
  oneOffExpenses: number;
  /** earned − the variable costs above (salary and recurring costs are monthly, shown separately). */
  beforeFixedCosts: number;
}

export type TransactionKind = "deposit" | "balance" | "refund" | "kept_deposit" | "expense" | "recurring" | "transport" | "salary" | "products" | "materials";

export interface Transaction {
  date: string;
  direction: "in" | "out";
  kind: TransactionKind;
  label: string;
  amount: number;
  bookingId?: string;
}

export interface MonthFigures {
  month: string;
  label: string;
  isCurrent: boolean;
  /** First tracked month, starting after the 1st. */
  isLaunchPartial: boolean;
  /** Days counted for salary / recurring costs (from tracking start, and up to today this month). */
  daysCounted: number;
  daysInMonth: number;
  firstDayCounted: string;
  lastDayCounted: string;
  appointments: number;
  workingDays: number;
  earned: number;
  keptDeposits: number;
  keptDepositList: KeptDeposit[];
  collected: number;
  outstanding: number;
  unpaid: UnpaidBooking[];
  /** Past appointments still "quoted" / "deposit_paid" — Nessy should complete or cancel them. */
  stuck: StuckBooking[];
  /** Cash in: payments whose received date (Lagos) falls in this month, whatever the
   * appointment's month — deposits + balances − refunds. Not the same as `collected`, which is
   * what this month's appointments have paid (possibly in an earlier or later month). */
  moneyReceived: number;
  moneyReceivedBreakdown: { deposits: number; balances: number; refunds: number; payments: number };
  costs: {
    products: number;
    productBookings: number;
    productsMissing: number;
    productsMissingIds: string[];
    materials: number;
    materialBookings: number;
    transport: number;
    transportDays: { date: string; rate: number; appointments: number }[];
    salary: number;
    salaryNote: string;
    oneOffExpenses: number;
    recurringExpenses: number;
    total: number;
  };
  profit: number;
  /** profit ÷ (earned + kept deposits); null when there's no income. */
  margin: number | null;
  cashProfit: number;
  byCategory: CategoryFigures[];
  weeks: WeekFigures[];
  transactions: Transaction[];
  /** Full-month fixed costs at the month's rates (salary + recurring) — for break-even. */
  fixedCostsFullMonth: number;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function recurringOnDay(r: RecurringExpense, day: string): boolean {
  return r.startDate <= day && (r.endDate === null || r.endDate >= day);
}

export function computeMonth(input: FinanceInput, month: string): MonthFigures {
  const today = watDateOf(input.now);
  const currentMonth = monthOf(today);
  const isCurrent = month === currentMonth;
  const dim = daysInMonth(month);
  const firstDayCounted = input.trackingStart > monthStart(month) ? input.trackingStart : monthStart(month);
  const lastDayCounted = isCurrent && today < monthEnd(month) ? today : monthEnd(month);
  const countedDays = firstDayCounted <= lastDayCounted ? eachDay(firstDayCounted, lastDayCounted) : [];
  const isLaunchPartial = monthOf(input.trackingStart) === month && input.trackingStart > monthStart(month);

  const inMonth = (b: FinBooking) => monthOf(b.date) === month && b.date >= input.trackingStart;
  const earnedBookings = input.bookings.filter(b => inMonth(b) && isEarned(b, input.now) && b.quotedPrice != null);
  const transactions: Transaction[] = [];

  // Income: earned, collected, outstanding
  let collected = 0;
  const unpaid: UnpaidBooking[] = [];
  for (const b of earnedBookings) {
    const pays = paymentsFor(b, input.payments, input.depositPercentage);
    const paid = Math.max(0, netReceived(pays));
    const price = b.quotedPrice ?? 0;
    collected += Math.min(paid, price);
    if (paid < price) unpaid.push({ bookingId: b.id, clientName: b.clientName, date: b.date, price, paid, owed: price - paid });
    for (const p of pays) {
      transactions.push({
        date: watDateOf(Date.parse(p.receivedAt)), direction: p.kind === "refund" ? "out" : "in", kind: p.kind,
        label: `${p.kind === "deposit" ? "Deposit" : p.kind === "balance" ? "Balance" : "Refund"} · ${b.clientName}`,
        amount: p.amount, bookingId: b.id,
      });
    }
  }
  const earned = sum(earnedBookings.map(b => b.quotedPrice ?? 0));

  // Rule 4: kept deposits on cancelled bookings, in the original appointment's month
  const keptDepositList: KeptDeposit[] = [];
  for (const b of input.bookings.filter(b => inMonth(b) && b.status === "cancelled")) {
    const pays = paymentsFor(b, input.payments, input.depositPercentage);
    const kept = netReceived(pays);
    if (kept > 0) {
      const kind = pays.some(p => p.kind === "balance") ? "payment" : "deposit";
      keptDepositList.push({ bookingId: b.id, clientName: b.clientName, date: b.date, amount: kept, kind });
      transactions.push({ date: b.date, direction: "in", kind: "kept_deposit", label: `${keptLabel([kind])} · ${b.clientName} (cancelled)`, amount: kept, bookingId: b.id });
    }
  }
  const keptDeposits = sum(keptDepositList.map(k => k.amount));

  // Past appointments still "quoted" / "deposit_paid": not Earned until completed (or cancelled).
  const stuck: StuckBooking[] = input.bookings
    .filter(b => inMonth(b) && (b.status === "quoted" || b.status === "deposit_paid") && hasStarted(b, input.now))
    .map(b => ({ bookingId: b.id, clientName: b.clientName, date: b.date, time: b.time, status: b.status as StuckBooking["status"], price: b.quotedPrice }))
    .sort((a, z) => a.date.localeCompare(z.date));

  // Money received this month: by the payment's received date, for any booking.
  const moneyReceivedBreakdown = { deposits: 0, balances: 0, refunds: 0, payments: 0 };
  for (const b of input.bookings) {
    for (const p of paymentsFor(b, input.payments, input.depositPercentage)) {
      if (monthOf(watDateOf(Date.parse(p.receivedAt))) !== month) continue;
      moneyReceivedBreakdown.payments += 1;
      if (p.kind === "deposit") moneyReceivedBreakdown.deposits += p.amount;
      else if (p.kind === "balance") moneyReceivedBreakdown.balances += p.amount;
      else moneyReceivedBreakdown.refunds += p.amount;
    }
  }
  const moneyReceived = moneyReceivedBreakdown.deposits + moneyReceivedBreakdown.balances - moneyReceivedBreakdown.refunds;

  // Costs: products, materials
  const productsMissingIds = earnedBookings.filter(b => b.productCost == null).map(b => b.id);
  const products = sum(earnedBookings.map(b => b.productCost ?? 0));
  const materials = sum(earnedBookings.map(materialsCost));
  for (const b of earnedBookings) {
    if (b.productCost) transactions.push({ date: b.date, direction: "out", kind: "products", label: `Products · ${b.clientName}`, amount: b.productCost, bookingId: b.id });
    const m = materialsCost(b);
    if (m) transactions.push({ date: b.date, direction: "out", kind: "materials", label: `Materials bought · ${b.clientName}`, amount: m, bookingId: b.id });
  }

  // Transport: one fare per distinct hair day, at that day's rate
  const byDay = new Map<string, number>();
  for (const b of earnedBookings) byDay.set(b.date, (byDay.get(b.date) ?? 0) + 1);
  const transportDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, appointments]) => ({ date, rate: rateOn(input.rates, "transport_daily", date), appointments }));
  const transport = sum(transportDays.map(d => d.rate));
  for (const d of transportDays) {
    if (d.rate) transactions.push({ date: d.date, direction: "out", kind: "transport", label: `Transport (${d.appointments} appointment${d.appointments === 1 ? "" : "s"})`, amount: d.rate });
  }

  // Salary and recurring costs accrue per counted day
  const salaryExact = sum(countedDays.map(d => rateOn(input.rates, "staff_salary", d) / dim));
  const salary = Math.round(salaryExact);
  const salaryRates = [...new Set(countedDays.map(d => rateOn(input.rates, "staff_salary", d)))];
  let salaryNote = salaryRates.length === 1 ? `Salary: ${formatNaira(salaryRates[0])}` : "Salary: rate changed during the month";
  if (isLaunchPartial) salaryNote += ` · Part month: live from ${shortDate(input.trackingStart)}, salary prorated ${countedDays.length}/${dim}`;
  else if (isCurrent && countedDays.length < dim) salaryNote += ` · Month to date: ${countedDays.length} of ${dim} days`;
  if (salary) transactions.push({ date: lastDayCounted, direction: "out", kind: "salary", label: "Staff salary", amount: salary });

  const oneOff = input.expenses.filter(e => monthOf(e.date) === month && e.date >= input.trackingStart);
  const oneOffExpenses = sum(oneOff.map(e => e.amount));
  for (const e of oneOff) transactions.push({ date: e.date, direction: "out", kind: "expense", label: `${e.category}${e.note ? ` · ${e.note}` : ""}`, amount: e.amount });

  let recurringExpenses = 0;
  for (const r of input.recurring) {
    const days = countedDays.filter(d => recurringOnDay(r, d)).length;
    if (!days) continue;
    const amount = Math.round(r.amount * days / dim);
    recurringExpenses += amount;
    transactions.push({
      date: countedDays.find(d => recurringOnDay(r, d))!, direction: "out", kind: "recurring",
      label: `${r.category}${r.note ? ` · ${r.note}` : ""} (monthly${days < dim ? `, ${days}/${dim} days` : ""})`, amount,
    });
  }

  const total = products + materials + transport + salary + oneOffExpenses + recurringExpenses;
  const income = earned + keptDeposits;
  const profit = income - total;

  // Per category (before transport, salary and overheads)
  const cats = new Map<string, FinBooking[]>();
  for (const b of earnedBookings) cats.set(b.category, [...(cats.get(b.category) ?? []), b]);
  const byCategory: CategoryFigures[] = [...cats.entries()].map(([category, list]) => {
    const revenue = sum(list.map(b => b.quotedPrice ?? 0));
    const prod = sum(list.map(b => b.productCost ?? 0));
    const mat = sum(list.map(materialsCost));
    return {
      category, bookings: list.length, revenue, products: prod, materials: mat, profit: revenue - prod - mat,
      avgPrice: revenue / list.length, avgProfit: (revenue - prod - mat) / list.length,
      productShare: revenue > 0 ? prod / revenue : 0, missingProductCost: list.filter(b => b.productCost == null).length,
    };
  }).sort((a, b) => b.avgProfit - a.avgProfit);

  // Mon–Sun weeks, clipped to the month
  const weeks: WeekFigures[] = [];
  for (let start = monthStart(month); start <= monthEnd(month);) {
    const wkEnd = addDaysToDate(weekStartOf(start), 6);
    const end = wkEnd < monthEnd(month) ? wkEnd : monthEnd(month);
    const inWeek = (d: string) => d >= start && d <= end;
    const wb = earnedBookings.filter(b => inWeek(b.date));
    const w = {
      start, end, appointments: wb.length, earned: sum(wb.map(b => b.quotedPrice ?? 0)),
      products: sum(wb.map(b => b.productCost ?? 0)), materials: sum(wb.map(materialsCost)),
      transport: sum(transportDays.filter(d => inWeek(d.date)).map(d => d.rate)),
      oneOffExpenses: sum(oneOff.filter(e => inWeek(e.date)).map(e => e.amount)),
    };
    weeks.push({ ...w, beforeFixedCosts: w.earned - w.products - w.materials - w.transport - w.oneOffExpenses });
    start = addDaysToDate(end, 1);
  }

  const fixedCostsFullMonth = rateOn(input.rates, "staff_salary", monthEnd(month))
    + sum(input.recurring.filter(r => recurringOnDay(r, monthEnd(month)) || recurringOnDay(r, monthStart(month))).map(r => r.amount));

  transactions.sort((a, b) => a.date.localeCompare(b.date) || (a.direction === b.direction ? 0 : a.direction === "in" ? -1 : 1));

  return {
    month, label: monthLabel(month), isCurrent, isLaunchPartial,
    daysCounted: countedDays.length, daysInMonth: dim, firstDayCounted, lastDayCounted,
    appointments: earnedBookings.length, workingDays: transportDays.length,
    earned, keptDeposits, keptDepositList, collected, outstanding: sum(unpaid.map(u => u.owed)), unpaid,
    moneyReceived, moneyReceivedBreakdown, stuck,
    costs: {
      products, productBookings: earnedBookings.length - productsMissingIds.length, productsMissing: productsMissingIds.length, productsMissingIds,
      materials, materialBookings: earnedBookings.filter(b => materialsCost(b) > 0).length,
      transport, transportDays, salary, salaryNote, oneOffExpenses, recurringExpenses, total,
    },
    profit, margin: income > 0 ? profit / income : null, cashProfit: collected + keptDeposits - total,
    byCategory, weeks, transactions, fixedCostsFullMonth,
  };
}

/** Every month from the tracking start's month to the current month, oldest first. */
export function trackedMonths(input: Pick<FinanceInput, "trackingStart" | "now">): string[] {
  const last = monthOf(watDateOf(input.now));
  const out: string[] = [];
  for (let m = monthOf(input.trackingStart); m <= last; m = nextMonth(m)) out.push(m);
  return out;
}

export interface FinanceTotals {
  earned: number;
  keptDeposits: number;
  collected: number;
  outstanding: number;
  /** All payments received since tracking started, by received date. */
  moneyReceived: number;
  appointments: number;
  costs: { products: number; materials: number; transport: number; salary: number; otherExpenses: number; total: number };
  profit: number;
  cashProfit: number;
  productsMissing: number;
}

export function computeAll(input: FinanceInput): { months: MonthFigures[]; totals: FinanceTotals } {
  const months = trackedMonths(input).map(m => computeMonth(input, m));
  const t = (f: (m: MonthFigures) => number) => sum(months.map(f));
  return {
    months,
    totals: {
      earned: t(m => m.earned), keptDeposits: t(m => m.keptDeposits), collected: t(m => m.collected),
      outstanding: t(m => m.outstanding), moneyReceived: t(m => m.moneyReceived), appointments: t(m => m.appointments),
      costs: {
        products: t(m => m.costs.products), materials: t(m => m.costs.materials), transport: t(m => m.costs.transport),
        salary: t(m => m.costs.salary), otherExpenses: t(m => m.costs.oneOffExpenses + m.costs.recurringExpenses), total: t(m => m.costs.total),
      },
      profit: t(m => m.profit), cashProfit: t(m => m.cashProfit), productsMissing: t(m => m.costs.productsMissing),
    },
  };
}

// ─── Month close ────────────────────────────────────────────────────────────────────────────

/** The figures kept in monthly_reports at close — enough to tell later what changed. */
export interface MonthSnapshot {
  earned: number;
  keptDeposits: number;
  collected: number;
  outstanding: number;
  moneyReceived: number;
  appointments: number;
  workingDays: number;
  products: number;
  productsMissing: number;
  materials: number;
  transport: number;
  salary: number;
  otherExpenses: number;
  totalCosts: number;
  profit: number;
  cashProfit: number;
}

export function snapshotOf(m: MonthFigures): MonthSnapshot {
  return {
    earned: m.earned, keptDeposits: m.keptDeposits, collected: m.collected, outstanding: m.outstanding, moneyReceived: m.moneyReceived,
    appointments: m.appointments, workingDays: m.workingDays, products: m.costs.products, productsMissing: m.costs.productsMissing,
    materials: m.costs.materials, transport: m.costs.transport, salary: m.costs.salary,
    otherExpenses: m.costs.oneOffExpenses + m.costs.recurringExpenses, totalCosts: m.costs.total,
    profit: m.profit, cashProfit: m.cashProfit,
  };
}

const SNAPSHOT_LABELS: Record<keyof MonthSnapshot, string> = {
  earned: "Earned", keptDeposits: "Kept deposits", collected: "Collected", outstanding: "Outstanding", moneyReceived: "Money received",
  appointments: "Appointments", workingDays: "Hair days", products: "Products", productsMissing: "Bookings missing product cost",
  materials: "Materials", transport: "Transport", salary: "Salary", otherExpenses: "Other expenses",
  totalCosts: "Total costs", profit: "Profit", cashProfit: "Cash profit",
};

const COUNT_FIELDS = new Set<keyof MonthSnapshot>(["appointments", "workingDays", "productsMissing"]);

export interface SnapshotChange { field: keyof MonthSnapshot; label: string; before: number; after: number; display: string }

/** What's different now from the figures stored when the month was closed. */
export function changesSinceClose(snapshot: Partial<MonthSnapshot>, live: MonthFigures): SnapshotChange[] {
  const now = snapshotOf(live);
  const out: SnapshotChange[] = [];
  for (const field of Object.keys(SNAPSHOT_LABELS) as (keyof MonthSnapshot)[]) {
    const before = snapshot[field];
    if (typeof before !== "number" || before === now[field]) continue;
    const fmt = (n: number) => (COUNT_FIELDS.has(field) ? String(n) : formatNaira(n));
    // Display only: the stored field stays "keptDeposits"; the label follows what was kept.
    const label = field === "keptDeposits" ? keptLabel(live.keptDepositList.map(k => k.kind), true) : SNAPSHOT_LABELS[field];
    out.push({ field, label, before, after: now[field], display: `${label}: ${fmt(before)} → ${fmt(now[field])}` });
  }
  return out;
}

/** Finished months (before the current one, from tracking start) that have no closed report. */
export function monthsToClose(input: Pick<FinanceInput, "trackingStart" | "now">, closed: string[]): string[] {
  const current = monthOf(watDateOf(input.now));
  return trackedMonths(input).filter(m => m < current && !closed.includes(m));
}

/**
 * The dashboard's "Your <month> report is ready" notice: shown for 7 days starting the day the
 * report was closed (Lagos) — normally the 1st to the 7th; a catch-up close shows it from that day.
 */
export function reportNoticeVisible(today: string, closedAt: string | null | undefined): boolean {
  if (!closedAt) return false;
  const closedDay = watDateOf(Date.parse(closedAt));
  return closedDay <= today && today < addDaysToDate(closedDay, 7);
}

/** "4 past bookings still quoted — complete or cancel them" (Finances month report). */
export function stuckHeadline(m: Pick<MonthFigures, "stuck">): string {
  const n = m.stuck.length;
  const kinds = new Set(m.stuck.map(s => s.status));
  const state = kinds.size === 2 ? "still quoted or awaiting a deposit check" : kinds.has("quoted") ? "still quoted" : "still awaiting a deposit check";
  return `${n} past booking${n === 1 ? "" : "s"} ${state} — complete or cancel ${n === 1 ? "it" : "them"}`;
}
