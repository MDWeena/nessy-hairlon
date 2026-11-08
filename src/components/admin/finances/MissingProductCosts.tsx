import { useState } from "react";
import { Check } from "lucide-react";
import { isEarned, shortDate, monthOf } from "../../../lib/finance";
import { toFinanceInput } from "../../../lib/financeData";
import type { FinanceState } from "../../../hooks/useFinances";
import { ProductCostField } from "../ProductCostField";

/** Earned bookings with no product cost yet — fill them in quickly, one tap to save each. */
export function MissingProductCosts({ fin, month }: { fin: FinanceState; month: string | null }) {
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  if (!fin.rows) return null;

  const input = toFinanceInput(fin.rows, now);
  const missing = input.bookings
    .filter(b => b.productCost == null && isEarned(b, input.now) && b.date >= input.trackingStart && (!month || monthOf(b.date) === month))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (missing.length === 0 && saved.size === 0) return <p className="text-[13px] text-text-muted m-0">All caught up — every booking has a product cost.</p>;

  return (
    <ul data-testid="missing-product-costs" className="m-0 p-0 list-none grid gap-3">
      {missing.map(b => {
        const typical = fin.categoryCosts.get(b.category) ?? null;
        const value = values[b.id] === undefined ? typical : values[b.id];
        return (
          <li key={b.id} className="border border-border rounded-lg p-3 grid gap-2">
            <div className="text-[13px]"><strong>{b.clientName}</strong> <span className="text-text-muted">· {shortDate(b.date)} · {b.category}</span></div>
            <ProductCostField value={value} onChange={(v) => setValues(p => ({ ...p, [b.id]: v }))} typical={typical} category={b.category} label="Products used" />
            <button type="button" disabled={value === null || saving === b.id}
              onClick={async () => { setSaving(b.id); try { await fin.setProductCost(b.id, value); setSaved(p => new Set(p).add(b.id)); } finally { setSaving(null); } }}
              className={`w-full sm:w-fit border-none rounded-md py-1.5 px-3.5 text-xs font-bold min-h-11 md:min-h-0 ${value === null ? "bg-border text-text-muted cursor-default" : "bg-gold text-theme-black cursor-pointer"}`}>
              {saving === b.id ? "Saving…" : "Save"}
            </button>
          </li>
        );
      })}
      {saved.size > 0 && <li className="text-[12px] text-[#0E9F6E] flex items-center gap-1"><Check size={14} aria-hidden="true" /> {saved.size} saved</li>}
    </ul>
  );
}
