import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { formatNaira, type MonthFigures } from "../../../lib/finance";

/**
 * Revenue vs costs per month (two bars, one naira axis) with a profit/loss line. Colours were
 * run through the dataviz palette validator against both admin surfaces (light #F5EDE3, dark
 * #1E1914): lightness band, chroma, colour-blind separation and contrast all pass. The profit
 * line is drawn in text ink, so it never depends on telling a third hue apart. Every month has a
 * hover / tap target with the exact figures, and a table view lists them all.
 */
const PALETTE = {
  light: { revenue: "#B7791F", costs: "#4F52D1" },
  dark: { revenue: "#C2821A", costs: "#7477E8" },
};

function compact(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}m` : a >= 1000 ? `${Math.round(a / 1000)}k` : String(Math.round(a));
  return `${n < 0 ? "−" : ""}₦${s}`;
}

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / 2) * 2 * p;
}

export function FinanceChart({ months }: { months: MonthFigures[] }) {
  const { isDark } = useTheme();
  const colors = isDark ? PALETTE.dark : PALETTE.light;
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  // Draw at the real width (not a scaled 640px canvas) so axis text stays 10–11px on a phone.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w > 0) setW(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [months.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- re-attach once the chart first renders

  const H = W < 480 ? 200 : 240, padL = 52, padR = 12, padT = 16, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const revenue = months.map(m => m.earned + m.keptDeposits);
  const costs = months.map(m => m.costs.total);
  const profit = months.map(m => m.profit);
  const max = niceMax(Math.max(...revenue, ...costs, ...profit, 0));
  const min = Math.min(0, ...profit) < 0 ? -niceMax(-Math.min(...profit)) : 0;
  const y = (v: number) => padT + plotH * (1 - (v - min) / (max - min));
  const slot = plotW / Math.max(months.length, 1);
  const barW = Math.min(22, slot * 0.28);
  const cx = (i: number) => padL + slot * i + slot / 2;
  const ticks = [min, (min + max) / 2, max].filter((v, i, a) => a.indexOf(v) === i);
  if (min < 0 && !ticks.includes(0)) ticks.push(0);

  if (months.length === 0) return null;
  const a = active !== null ? months[active] : null;

  return (
    <figure className="m-0" data-testid="finance-chart">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-[11px] text-text-soft" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: colors.revenue }} /> Revenue</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: colors.costs }} /> Costs</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-text rounded" /> Profit / loss</span>
      </div>
      <div className="relative" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img"
          aria-label={`Revenue, costs and profit by month: ${months.map((m, i) => `${m.label} revenue ${formatNaira(revenue[i])}, costs ${formatNaira(costs[i])}, ${profit[i] >= 0 ? "profit" : "loss"} ${formatNaira(Math.abs(profit[i]))}`).join("; ")}`}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="currentColor" className={t === 0 ? "text-text-muted" : "text-border"} strokeWidth={t === 0 ? 1 : 0.75} strokeDasharray={t === 0 ? undefined : "3 3"} />
              <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} className="fill-text-muted">{compact(t)}</text>
            </g>
          ))}
          {months.map((m, i) => (
            <g key={m.month}>
              <rect x={cx(i) - barW - 1} y={y(Math.max(revenue[i], 0))} width={barW} height={Math.max(0, y(0) - y(revenue[i]))} rx={3} fill={colors.revenue} opacity={active === null || active === i ? 1 : 0.45} />
              <rect x={cx(i) + 1} y={y(costs[i])} width={barW} height={Math.max(0, y(0) - y(costs[i]))} rx={3} fill={colors.costs} opacity={active === null || active === i ? 1 : 0.45} />
              <text x={cx(i)} y={H - padB + 14} textAnchor="middle" fontSize={10} className="fill-text-soft">{m.label.slice(0, 3)}{months.length <= 6 ? ` ${m.month.slice(2, 4)}` : ""}</text>
            </g>
          ))}
          {months.length > 1 && (
            <polyline fill="none" stroke="currentColor" className="text-text" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              points={months.map((_, i) => `${cx(i)},${y(profit[i])}`).join(" ")} />
          )}
          {months.map((m, i) => (
            <circle key={m.month} cx={cx(i)} cy={y(profit[i])} r={active === i ? 5.5 : 4.5} className="fill-text" stroke="var(--surface)" strokeWidth={2} />
          ))}
          {/* Hit targets: the whole month column, bigger than the marks. */}
          {months.map((m, i) => (
            <rect key={m.month} x={padL + slot * i} y={padT} width={slot} height={plotH + padB} fill="transparent"
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === i ? null : i)}
              data-testid={`chart-month-${m.month}`} />
          ))}
        </svg>
        {a && (
          <div role="tooltip" className="absolute top-1 right-1 bg-surface border border-border rounded-lg shadow-lg py-2 px-3 text-[11px] grid gap-0.5 pointer-events-none min-w-[150px]">
            <strong className="text-[12px] text-text">{a.label}{a.isCurrent ? " (to date)" : ""}</strong>
            <span className="flex justify-between gap-3 text-text-soft"><span>Revenue</span><span className="text-text font-semibold">{formatNaira(a.earned + a.keptDeposits)}</span></span>
            <span className="flex justify-between gap-3 text-text-soft"><span>Costs</span><span className="text-text font-semibold">{formatNaira(a.costs.total)}</span></span>
            <span className="flex justify-between gap-3 text-text-soft"><span>{a.profit >= 0 ? "Profit" : "Loss"}</span><span className="text-text font-semibold">{formatNaira(Math.abs(a.profit))}</span></span>
          </div>
        )}
      </div>
      <button type="button" onClick={() => setShowTable(v => !v)} className="mt-2 bg-transparent border-none p-0 text-[11px] text-gold underline cursor-pointer">
        {showTable ? "Hide table" : "Show as table"}
      </button>
      {showTable && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12px] border-collapse">
            <thead><tr className="text-text-muted text-left"><th className="py-1 pr-2 font-semibold">Month</th><th className="py-1 px-2 font-semibold text-right">Revenue</th><th className="py-1 px-2 font-semibold text-right">Costs</th><th className="py-1 pl-2 font-semibold text-right">Profit / loss</th></tr></thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={m.month} className="border-t border-border">
                  <td className="py-1 pr-2">{m.label}</td>
                  <td className="py-1 px-2 text-right">{formatNaira(revenue[i])}</td>
                  <td className="py-1 px-2 text-right">{formatNaira(costs[i])}</td>
                  <td className="py-1 pl-2 text-right">{profit[i] >= 0 ? "Profit" : "Loss"} {formatNaira(Math.abs(profit[i]))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
