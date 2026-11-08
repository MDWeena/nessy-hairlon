import type { ReactNode } from "react";
import { Lightbulb, PartyPopper, Info, History } from "lucide-react";
import { formatNaira, type SnapshotChange } from "../../../lib/finance";
import type { Insight } from "../../../lib/financeInsights";

/** Profit or loss — always the word plus the sign, so it never relies on green/red alone. */
export function ProfitLoss({ value, className = "" }: { value: number; className?: string }) {
  const profit = value >= 0;
  return (
    <span data-testid="profit-loss" className={`${profit ? "text-[#0E9F6E]" : "text-[#DC2626]"} font-bold ${className}`}>
      {profit ? "Profit" : "Loss"} {formatNaira(Math.abs(value))}
    </span>
  );
}

export function Card({ title, children, right, testId }: { title?: string; children: ReactNode; right?: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="bg-surface rounded-xl border border-border p-4 md:p-5 mb-4">
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 mb-3">
          {title && <h3 className="text-[15px] font-bold m-0">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/** A label/value line with an optional plain-language explanation underneath. */
export function Line({ label, value, hint, strong, children }: { label: string; value: ReactNode; hint?: ReactNode; strong?: boolean; children?: ReactNode }) {
  return (
    <div className="py-2 border-b border-border last:border-b-0">
      <div className="flex justify-between items-baseline gap-3">
        <span className={`text-[13px] ${strong ? "font-bold" : "text-text-soft"}`}>{label}</span>
        <span className={`text-[13px] text-right ${strong ? "font-bold" : "font-semibold"}`}>{value}</span>
      </div>
      {hint && <p className="text-[11px] text-text-muted mt-0.5 mb-0">{hint}</p>}
      {children}
    </div>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "gold" | "info" }) {
  const cls = tone === "gold" ? "bg-gold-bg text-gold border-[#C49A6C40]" : tone === "info" ? "bg-[#6366F115] text-[#4F52D1] border-[#6366F140]" : "bg-bg-alt text-text-muted border-border";
  return <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-[0.5px] py-0.5 px-1.5 rounded border whitespace-nowrap ${cls}`}>{children}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-bg-alt rounded-lg p-3 min-w-0">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="text-[17px] font-bold mt-0.5 break-words">{value}</div>
      {sub && <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

const TONE_ICON = { good: PartyPopper, tip: Lightbulb, heads_up: Info } as const;
const TONE_CLASS = {
  good: "border-[#10B98140] bg-[#10B98110]",
  tip: "border-[#C49A6C40] bg-gold-bg",
  heads_up: "border-[#F59E0B40] bg-[#F59E0B10]",
} as const;

export function InsightCard({ insight }: { insight: Insight }) {
  const Icon = TONE_ICON[insight.tone];
  return (
    <article data-testid="insight" className={`rounded-lg border p-3 ${TONE_CLASS[insight.tone]}`}>
      <h4 className="m-0 text-[13px] font-bold flex items-start gap-2"><Icon size={15} className="shrink-0 mt-px" aria-hidden="true" /> {insight.title}</h4>
      <p className="m-0 mt-1 text-[12px] text-text-soft leading-[1.5]">{insight.body}</p>
      {insight.figures.length > 0 && (
        <dl className="m-0 mt-2 grid gap-0.5">
          {insight.figures.map(f => (
            <div key={f.label} className="flex justify-between gap-3 text-[11px]">
              <dt className="text-text-muted">{f.label}</dt><dd className="m-0 font-semibold text-right">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export function UpdatedSinceClose({ closedAt, changes }: { closedAt: string; changes: SnapshotChange[] }) {
  if (changes.length === 0) return null;
  const d = new Date(Date.parse(closedAt) + 3600_000);
  const when = `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
  return (
    <div role="status" data-testid="updated-since-close" className="rounded-lg border border-[#6366F140] bg-[#6366F110] p-3 mb-4">
      <p className="m-0 text-[13px] font-bold flex items-center gap-2"><History size={14} aria-hidden="true" /> Updated since this report was closed on {when}</p>
      <ul className="m-0 mt-1.5 pl-5 text-[12px] text-text-soft">
        {changes.map(c => <li key={c.field}>{c.display}</li>)}
      </ul>
    </div>
  );
}


