import { useState } from "react";
import { Plus, Pencil, Trash2, Repeat } from "lucide-react";
import { EXPENSE_CATEGORIES, formatNaira, monthLabel, monthOf, shortDate, type ExpenseCategory } from "../../../lib/finance";
import { watDateOf } from "../../../lib/reminders";
import type { FinanceState } from "../../../hooks/useFinances";
import { MoneyInput } from "../../ui/MoneyInput";
import { ErrorNotice } from "../../ui/ErrorNotice";
import { Card } from "./parts";

const INPUT = "w-full py-2 px-2.5 rounded-md border border-border bg-bg-alt text-[13px] text-text outline-none box-border min-h-11 md:min-h-0";

interface Draft { id: string | null; date: string; category: ExpenseCategory; amount: number; note: string }

const blank = (): Draft => ({ id: null, date: watDateOf(Date.now()), category: "Supplies (bulk)", amount: 0, note: "" });

export function ExpensesPanel({ fin, months }: { fin: FinanceState; months: string[] }) {
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [recurringDraft, setRecurringDraft] = useState<{ category: ExpenseCategory; amount: number; note: string; startDate: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const expenses = (fin.rows?.expenses ?? [])
    .filter(e => monthFilter === "all" || monthOf(e.expense_date) === monthFilter)
    .filter(e => catFilter === "all" || e.category === catFilter);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const recurring = fin.rows?.recurring ?? [];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { console.error(err); setError("Couldn't save that. Please try again."); } finally { setBusy(false); }
  };

  const save = () => draft && run(async () => {
    if (!draft.amount) { setError("Enter an amount"); return; }
    const e = { date: draft.date, category: draft.category, amount: draft.amount, note: draft.note.trim() || null };
    if (draft.id) await fin.updateExpense(draft.id, e); else await fin.addExpense(e);
    setDraft(null);
  });

  return (
    <div data-testid="expenses-panel">
      {error && <ErrorNotice message={error} />}

      <Card title="Expenses" right={!draft && (
        <button type="button" onClick={() => setDraft(blank())} className="bg-gold text-theme-black border-none rounded-md py-1.5 px-3 text-xs font-bold cursor-pointer flex items-center gap-1 min-h-11 md:min-h-0">
          <Plus size={14} aria-hidden="true" /> Add expense
        </button>
      )}>
        {draft && (
          <div data-testid="expense-form" className="grid gap-2.5 mb-4 p-3 rounded-lg border border-border bg-bg-alt">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="text-[11px] text-text-muted font-semibold grid gap-1">Date
                <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} className={INPUT} />
              </label>
              <label className="text-[11px] text-text-muted font-semibold grid gap-1">Category
                <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as ExpenseCategory })} className={INPUT}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <label className="text-[11px] text-text-muted font-semibold grid gap-1">Amount
              <MoneyInput value={draft.amount} onChange={amount => setDraft({ ...draft, amount })} placeholder="amount" style={{ fontSize: 13 }} />
            </label>
            <label className="text-[11px] text-text-muted font-semibold grid gap-1">Note (optional)
              <input value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. New dryer" className={INPUT} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDraft(null)} className="flex-1 sm:flex-none bg-transparent border border-border rounded-md py-1.5 px-3 text-xs cursor-pointer min-h-11 md:min-h-0">Cancel</button>
              <button type="button" onClick={save} disabled={busy} className="flex-1 sm:flex-none bg-gold text-theme-black border-none rounded-md py-1.5 px-3.5 text-xs font-bold cursor-pointer min-h-11 md:min-h-0">{draft.id ? "Save changes" : "Add expense"}</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          <select aria-label="Filter by month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={`${INPUT} w-auto`}>
            <option value="all">All months</option>
            {[...months].reverse().map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select aria-label="Filter by category" value={catFilter} onChange={e => setCatFilter(e.target.value)} className={`${INPUT} w-auto`}>
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {expenses.length === 0 ? <p className="text-[13px] text-text-muted m-0">No expenses {monthFilter !== "all" || catFilter !== "all" ? "match these filters" : "yet"}.</p> : (
          <ul className="m-0 p-0 list-none">
            {expenses.map(e => (
              <li key={e.id} data-testid="expense-row" className="flex items-center gap-2 py-2 border-b border-border last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold break-words">{e.category}{e.note ? ` · ${e.note}` : ""}</div>
                  <div className="text-[11px] text-text-muted">{shortDate(e.expense_date)} {e.expense_date.slice(0, 4)}</div>
                </div>
                <span className="text-[13px] font-semibold shrink-0">{formatNaira(e.amount)}</span>
                {confirmDelete === e.id ? (
                  <span className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => run(async () => { await fin.deleteExpense(e.id); setConfirmDelete(null); })} className="bg-[#EF4444] text-white border-none rounded-md py-1 px-2 text-[11px] font-bold cursor-pointer min-h-11 md:min-h-0">Delete</button>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="bg-transparent border border-border rounded-md py-1 px-2 text-[11px] cursor-pointer min-h-11 md:min-h-0">Keep</button>
                  </span>
                ) : (
                  <span className="flex shrink-0">
                    <button type="button" aria-label={`Edit ${e.category} expense`} onClick={() => setDraft({ id: e.id, date: e.expense_date, category: e.category as ExpenseCategory, amount: e.amount, note: e.note ?? "" })} className="tap-target-sm bg-transparent border-none p-1 cursor-pointer text-text-soft"><Pencil size={14} /></button>
                    <button type="button" aria-label={`Delete ${e.category} expense`} onClick={() => setConfirmDelete(e.id)} className="tap-target-sm bg-transparent border-none p-1 cursor-pointer text-[#EF4444]"><Trash2 size={14} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {expenses.length > 0 && <p className="text-[12px] font-bold text-right mt-2 mb-0">Total: {formatNaira(total)}</p>}
      </Card>

      <Card title="Monthly costs" right={!recurringDraft && (
        <button type="button" onClick={() => setRecurringDraft({ category: "Rent & utilities", amount: 0, note: "", startDate: `${monthOf(watDateOf(Date.now()))}-01` })} className="bg-transparent border border-border rounded-md py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1 min-h-11 md:min-h-0">
          <Repeat size={13} aria-hidden="true" /> Add monthly cost
        </button>
      )}>
        <p className="text-[12px] text-text-muted mt-0 mb-3">For costs that repeat every month, like rent. They count from the start date until you stop them.</p>
        {recurringDraft && (
          <div className="grid gap-2.5 mb-3 p-3 rounded-lg border border-border bg-bg-alt">
            <select aria-label="Monthly cost category" value={recurringDraft.category} onChange={e => setRecurringDraft({ ...recurringDraft, category: e.target.value as ExpenseCategory })} className={INPUT}>
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <MoneyInput value={recurringDraft.amount} onChange={amount => setRecurringDraft({ ...recurringDraft, amount })} placeholder="amount per month" style={{ fontSize: 13 }} />
            <input value={recurringDraft.note} onChange={e => setRecurringDraft({ ...recurringDraft, note: e.target.value })} placeholder="Note (optional)" className={INPUT} />
            <label className="text-[11px] text-text-muted font-semibold grid gap-1">Starts
              <input type="date" value={recurringDraft.startDate} onChange={e => setRecurringDraft({ ...recurringDraft, startDate: e.target.value })} className={INPUT} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRecurringDraft(null)} className="flex-1 sm:flex-none bg-transparent border border-border rounded-md py-1.5 px-3 text-xs cursor-pointer min-h-11 md:min-h-0">Cancel</button>
              <button type="button" disabled={busy} onClick={() => run(async () => {
                if (!recurringDraft.amount) { setError("Enter an amount"); return; }
                await fin.addRecurring({ ...recurringDraft, note: recurringDraft.note.trim() || null });
                setRecurringDraft(null);
              })} className="flex-1 sm:flex-none bg-gold text-theme-black border-none rounded-md py-1.5 px-3.5 text-xs font-bold cursor-pointer min-h-11 md:min-h-0">Save monthly cost</button>
            </div>
          </div>
        )}
        {recurring.length === 0 ? <p className="text-[13px] text-text-muted m-0">No monthly costs.</p> : (
          <ul className="m-0 p-0 list-none">
            {recurring.map(r => (
              <li key={r.id} className="flex items-center gap-2 py-2 border-b border-border last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold break-words">{r.category}{r.note ? ` · ${r.note}` : ""}</div>
                  <div className="text-[11px] text-text-muted">From {shortDate(r.start_date)} {r.start_date.slice(0, 4)}{r.end_date ? ` to ${shortDate(r.end_date)} ${r.end_date.slice(0, 4)}` : " · running"}</div>
                </div>
                <span className="text-[13px] font-semibold shrink-0">{formatNaira(r.amount)}/mo</span>
                {!r.end_date && (
                  <button type="button" onClick={() => run(() => fin.stopRecurring(r.id, watDateOf(Date.now())))} className="bg-transparent border border-border rounded-md py-1 px-2 text-[11px] cursor-pointer shrink-0 min-h-11 md:min-h-0">Stop</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
