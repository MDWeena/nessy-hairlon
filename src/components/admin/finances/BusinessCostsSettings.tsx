import { useState } from "react";
import { Wallet } from "lucide-react";
import { useFinances } from "../../../hooks/useFinances";
import { useServices } from "../../../hooks/useServices";
import { formatNaira, monthOf, nextMonth, rateOn, shortDate, type RateKind } from "../../../lib/finance";
import { watDateOf } from "../../../lib/reminders";
import { MoneyInput } from "../../ui/MoneyInput";
import { ErrorNotice } from "../../ui/ErrorNotice";
import { LoadingNotice } from "../../ui/LoadingNotice";

const INPUT = "w-full py-2 px-2.5 rounded-md border border-border bg-bg-alt text-[13px] text-text outline-none box-border min-h-11 md:min-h-0";
const RATE_LABELS: Record<RateKind, { title: string; unit: string }> = {
  staff_salary: { title: "Staff salary", unit: "a month" },
  transport_daily: { title: "Daily transport", unit: "per working day" },
};

/**
 * Settings → "Business costs": the salary and transport rates (kept as a history — a change
 * applies from its "Effective from" date and never alters past months), the tracking start
 * date, and the typical product cost per service category (prefills quotes).
 */
export function BusinessCostsSettings() {
  const fin = useFinances();
  const { services } = useServices();
  const [today] = useState(() => watDateOf(Date.now()));
  const [editing, setEditing] = useState<{ kind: RateKind; amount: number; from: string } | null>(null);
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [catDrafts, setCatDrafts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (fin.loading) return <LoadingNotice label="Loading business costs…" />;
  const rates = (fin.rows?.rates ?? []).map(r => ({ kind: r.kind, amount: r.amount, effectiveFrom: r.effective_from }));
  const categories = [...new Set([...services.map(s => s.cat), "Custom style"])];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { console.error(err); setError("Couldn't save that. Please try again."); } finally { setBusy(false); }
  };

  return (
    <section data-testid="business-costs" className="bg-surface rounded-xl p-6 border border-border mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={18} className="text-gold" aria-hidden="true" />
        <h3 className="text-base font-bold m-0">Business costs</h3>
      </div>
      <p className="text-[12px] text-text-muted mt-0 mb-4">Private — used only for your Finances reports.</p>
      {error && <ErrorNotice message={error} />}

      {(Object.keys(RATE_LABELS) as RateKind[]).map(kind => {
        const current = rateOn(rates, kind, today);
        const upcoming = rates.filter(r => r.kind === kind && r.effectiveFrom > today).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
        const history = rates.filter(r => r.kind === kind && r.effectiveFrom <= today).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        const isEditing = editing?.kind === kind;
        return (
          <div key={kind} data-testid={`rate-${kind}`} className="py-3 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] text-text-soft">{RATE_LABELS[kind].title}</div>
                <div className="text-[15px] font-bold">{formatNaira(current)} <span className="text-[12px] font-normal text-text-muted">{RATE_LABELS[kind].unit}</span></div>
              </div>
              {!isEditing && (
                <button type="button" onClick={() => setEditing({ kind, amount: current, from: `${nextMonth(monthOf(today))}-01` })}
                  className="bg-transparent border border-border rounded-md py-1.5 px-3 text-xs cursor-pointer min-h-11 md:min-h-0">Change</button>
              )}
            </div>
            {upcoming.map(u => <p key={u.effectiveFrom} className="text-[11px] text-text-muted mt-1 mb-0">Changes to {formatNaira(u.amount)} from {shortDate(u.effectiveFrom)} {u.effectiveFrom.slice(0, 4)}</p>)}
            {history.length > 1 && (
              <p className="text-[11px] text-text-muted mt-1 mb-0">History: {history.map(h => `${formatNaira(h.amount)} ${h.effectiveFrom <= "2000-01-01" ? "from the start" : `from ${shortDate(h.effectiveFrom)} ${h.effectiveFrom.slice(0, 4)}`}`).join(" · ")}</p>
            )}
            {isEditing && editing && (
              <div className="grid gap-2.5 mt-3 p-3 rounded-lg border border-border bg-bg-alt">
                <label className="text-[11px] text-text-muted font-semibold grid gap-1">New amount
                  <MoneyInput value={editing.amount} onChange={amount => setEditing({ ...editing, amount })} style={{ fontSize: 13 }} />
                </label>
                <label className="text-[11px] text-text-muted font-semibold grid gap-1">Effective from
                  <input type="date" value={editing.from} onChange={e => setEditing({ ...editing, from: e.target.value })} className={INPUT} />
                </label>
                <p className="text-[11px] text-text-muted m-0">Months before this date keep the old rate.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(null)} className="flex-1 sm:flex-none bg-transparent border border-border rounded-md py-1.5 px-3 text-xs cursor-pointer min-h-11 md:min-h-0">Cancel</button>
                  <button type="button" disabled={busy || !editing.from} onClick={() => run(async () => { await fin.setRate(kind, editing.amount, editing.from); setEditing(null); })}
                    className="flex-1 sm:flex-none bg-gold text-theme-black border-none rounded-md py-1.5 px-3.5 text-xs font-bold cursor-pointer min-h-11 md:min-h-0">Save</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="py-3 border-b border-border">
        <div className="text-[13px] text-text-soft">Tracking start date</div>
        <p className="text-[11px] text-text-muted mt-0.5 mb-2">Finances count from this day. The first month is prorated from here.</p>
        <div className="flex gap-2 items-center">
          <input type="date" aria-label="Tracking start date" value={startDraft ?? fin.trackingStart ?? ""} onChange={e => setStartDraft(e.target.value)} className={`${INPUT} max-w-[200px]`} />
          {startDraft && startDraft !== fin.trackingStart && (
            <button type="button" disabled={busy} onClick={() => run(async () => { await fin.setTrackingStart(startDraft); setStartDraft(null); })}
              className="bg-gold text-theme-black border-none rounded-md py-1.5 px-3.5 text-xs font-bold cursor-pointer min-h-11 md:min-h-0">Save</button>
          )}
        </div>
      </div>

      <div className="pt-3" data-testid="category-costs">
        <div className="text-[13px] text-text-soft">Typical product cost per category</div>
        <p className="text-[11px] text-text-muted mt-0.5 mb-2">Prefills "Products you'll use" when you set a price. You can always adjust it per booking.</p>
        <div className="grid gap-2">
          {categories.map(cat => {
            const saved = fin.categoryCosts.get(cat);
            const draft = catDrafts[cat];
            return (
              <div key={cat} className="flex items-center gap-2">
                <span className="text-[13px] flex-1 min-w-0 break-words">{cat}</span>
                <MoneyInput value={draft ?? saved ?? 0} onChange={v => setCatDrafts(p => ({ ...p, [cat]: v }))} placeholder="not set" style={{ width: 120, fontSize: 13 }} />
                {draft !== undefined && draft !== saved && (
                  <button type="button" disabled={busy} onClick={() => run(async () => { await fin.setCategoryCost(cat, draft); setCatDrafts(p => { const n = { ...p }; delete n[cat]; return n; }); })}
                    className="bg-gold text-theme-black border-none rounded-md py-1.5 px-3 text-xs font-bold cursor-pointer min-h-11 md:min-h-0">Save</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
