import { useState } from "react";
import { ChevronLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { changesSinceClose, formatNaira, shortDate, type MonthFigures } from "../../../lib/finance";
import type { Insight } from "../../../lib/financeInsights";
import type { ClosedReport } from "../../../hooks/useFinances";
import { Badge, Card, InsightCard, Line, ProfitLoss, Stat, UpdatedSinceClose } from "./parts";

interface MonthReportProps {
  month: MonthFigures;
  insights: Insight[];
  report: ClosedReport | null;
  onBack: () => void;
  onFillProductCosts: (month: string) => void;
  onRecordRefund: (bookingId: string, amount: number) => Promise<void>;
}

function transportExplanation(m: MonthFigures): string {
  if (m.workingDays === 0) return "No hair days yet";
  const rates = [...new Set(m.costs.transportDays.map(d => d.rate))];
  return rates.length === 1
    ? `${m.workingDays} day${m.workingDays === 1 ? "" : "s"} × ${formatNaira(rates[0])}`
    : `${m.workingDays} days (rate changed: ${rates.map(formatNaira).join(" → ")} a day)`;
}

export function MonthReport({ month: m, insights, report, onBack, onFillProductCosts, onRecordRefund }: MonthReportProps) {
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [refunding, setRefunding] = useState<string | null>(null);
  const changes = report ? changesSinceClose(report.figures, m) : [];
  const tx = m.transactions.filter(t => filter === "all" || t.direction === filter);

  return (
    <div data-testid="month-report">
      <button type="button" onClick={onBack} className="bg-transparent border-none p-0 mb-3 text-[13px] text-gold cursor-pointer flex items-center gap-1 min-h-11 md:min-h-0">
        <ChevronLeft size={16} aria-hidden="true" /> All months
      </button>

      {/* Summary */}
      <Card testId="month-summary">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="m-0 text-xl font-bold">{m.label}</h2>
          {m.isCurrent && <Badge tone="info">Month to date</Badge>}
          {m.isLaunchPartial && <Badge tone="gold">Part month</Badge>}
          {report && <Badge>Closed {shortDate(new Date(Date.parse(report.closedAt) + 3600_000).toISOString().slice(0, 10))}</Badge>}
        </div>
        <ProfitLoss value={m.profit} className="text-2xl block" />
        <p className="m-0 mt-1 text-[12px] text-text-muted">
          {m.margin !== null ? `${Math.round(m.margin * 100)}% margin · ` : ""}Cash basis: {m.cashProfit >= 0 ? "profit" : "loss"} {formatNaira(Math.abs(m.cashProfit))}
        </p>
        {m.isLaunchPartial && <p className="m-0 mt-1 text-[12px] text-text-muted">{m.costs.salaryNote.split(" · ").slice(1).join(" · ")}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Stat label="Earned" value={formatNaira(m.earned)} />
          <Stat label="Costs" value={formatNaira(m.costs.total)} />
          <Stat label="Appointments" value={m.appointments} />
          <Stat label="Hair days" value={m.workingDays} />
        </div>
      </Card>

      {report && <UpdatedSinceClose closedAt={report.closedAt} changes={changes} />}

      {/* Income */}
      <Card title="Income" testId="income-section">
        <Line label="Earned" value={formatNaira(m.earned)} hint={`The full price of the ${m.appointments} appointment${m.appointments === 1 ? "" : "s"} that took place`} />
        <Line label="Kept deposits" value={formatNaira(m.keptDeposits)} hint={m.keptDepositList.length ? "Deposits kept from cancelled bookings" : "None this month"}>
          {m.keptDepositList.map(k => (
            <div key={k.bookingId} className="flex items-center justify-between gap-2 mt-1.5 text-[12px]">
              <span className="text-text-soft min-w-0">{k.clientName} · {shortDate(k.date)} · {formatNaira(k.amount)}</span>
              {refunding === k.bookingId ? (
                <span className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={async () => { await onRecordRefund(k.bookingId, k.amount); setRefunding(null); }}
                    className="bg-gold text-theme-black border-none rounded-md py-1 px-2 text-[11px] font-bold cursor-pointer min-h-11 md:min-h-0">Yes, refunded</button>
                  <button type="button" onClick={() => setRefunding(null)} className="bg-transparent border border-border rounded-md py-1 px-2 text-[11px] cursor-pointer min-h-11 md:min-h-0">Cancel</button>
                </span>
              ) : (
                <button type="button" onClick={() => setRefunding(k.bookingId)} className="bg-transparent border-none p-0 text-[11px] text-gold underline cursor-pointer shrink-0 min-h-11 md:min-h-0">Mark refunded</button>
              )}
            </div>
          ))}
        </Line>
        <Line label="Collected" value={formatNaira(m.collected)} hint="Paid so far for this month's appointments, whenever the money arrived" />
        <Line label="Outstanding" value={formatNaira(m.outstanding)} hint={m.unpaid.length ? `${m.unpaid.length} ${m.unpaid.length === 1 ? "client still owes" : "clients still owe"} a balance` : "Everyone has paid in full"}>
          {m.unpaid.length > 0 && (
            <ul data-testid="unpaid-list" className="m-0 mt-1.5 pl-0 list-none grid gap-1">
              {m.unpaid.map(u => (
                <li key={u.bookingId} className="flex justify-between gap-3 text-[12px]">
                  <span className="text-text-soft">{u.clientName} · {shortDate(u.date)}</span>
                  <span className="font-semibold">{formatNaira(u.owed)} owed</span>
                </li>
              ))}
            </ul>
          )}
        </Line>
      </Card>

      {/* Cash in by payment date — deliberately separate from Earned / Collected */}
      <Card title={`Money received in ${m.label.split(" ")[0]}`} testId="money-received">
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-[13px] text-text-soft">Cash in this month</span>
          <span className="text-[17px] font-bold">{formatNaira(m.moneyReceived)}</span>
        </div>
        <p className="text-[11px] text-text-muted mt-1 mb-2">
          Every payment that arrived between {shortDate(`${m.month}-01`)} and {shortDate(m.lastDayCounted > `${m.month}-01` ? m.lastDayCounted : `${m.month}-01`)}, whatever the appointment date — e.g. a deposit paid now for next month's booking.
          This is not the same as Earned (the full price of this month's appointments) or Collected (what this month's appointments have paid).
        </p>
        <Line label="Deposits" value={formatNaira(m.moneyReceivedBreakdown.deposits)} />
        <Line label="Balances" value={formatNaira(m.moneyReceivedBreakdown.balances)} />
        {m.moneyReceivedBreakdown.refunds > 0 && <Line label="Refunds paid back" value={`−${formatNaira(m.moneyReceivedBreakdown.refunds)}`} />}
      </Card>

      {/* Costs */}
      <Card title="Costs" testId="costs-section">
        <Line label="Products used" value={formatNaira(m.costs.products)}
          hint={<>{m.costs.productBookings} booking{m.costs.productBookings === 1 ? "" : "s"}{m.costs.productsMissing ? <>, <button type="button" onClick={() => onFillProductCosts(m.month)} className="bg-transparent border-none p-0 text-gold underline cursor-pointer text-[11px]">{m.costs.productsMissing} missing</button></> : ""}</>} />
        <Line label="Materials bought for clients" value={formatNaira(m.costs.materials)}
          hint={m.costs.materialBookings ? `Hair and accessories you bought for ${m.costs.materialBookings} booking${m.costs.materialBookings === 1 ? "" : "s"} (already included in the price)` : "None this month"} />
        <Line label="Transport" value={formatNaira(m.costs.transport)} hint={transportExplanation(m)} />
        <Line label="Staff salary" value={formatNaira(m.costs.salary)} hint={m.costs.salaryNote.replace(/^Salary: /, "")} />
        <Line label="Other expenses" value={formatNaira(m.costs.oneOffExpenses + m.costs.recurringExpenses)}
          hint={`${formatNaira(m.costs.oneOffExpenses)} one-off · ${formatNaira(m.costs.recurringExpenses)} monthly costs`} />
        <Line label="Total costs" value={formatNaira(m.costs.total)} strong />
      </Card>

      {/* Weeks */}
      <Card title="Week by week" testId="weeks-section">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[12px] border-collapse min-w-[320px]">
            <thead>
              <tr className="text-text-muted text-left">
                <th className="py-1.5 px-1 font-semibold">Week</th>
                <th className="py-1.5 px-1 font-semibold text-right">Appts</th>
                <th className="py-1.5 px-1 font-semibold text-right">Earned</th>
                <th className="py-1.5 px-1 font-semibold text-right">Before salary</th>
              </tr>
            </thead>
            <tbody>
              {m.weeks.map(w => (
                <tr key={w.start} className="border-t border-border">
                  <td className="py-1.5 px-1 whitespace-nowrap">{shortDate(w.start)}{w.end !== w.start ? `–${shortDate(w.end).split(" ")[0]}` : ""}</td>
                  <td className="py-1.5 px-1 text-right">{w.appointments}</td>
                  <td className="py-1.5 px-1 text-right">{formatNaira(w.earned)}</td>
                  <td className="py-1.5 px-1 text-right">{formatNaira(w.beforeFixedCosts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-text-muted mt-2 mb-0">"Before salary" is what each week's appointments left after products, materials, transport and one-off expenses. Salary and monthly costs are counted once for the month.</p>
      </Card>

      {/* Transactions */}
      <Card title="Transactions" testId="transactions-section" right={
        <div role="group" aria-label="Filter transactions" className="flex gap-1">
          {(["all", "in", "out"] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`py-1 px-2.5 rounded-full text-[11px] border cursor-pointer min-h-11 md:min-h-0 ${filter === f ? "border-gold bg-gold-bg text-gold font-bold" : "border-border bg-transparent text-text-soft"}`}>
              {f === "all" ? "All" : f === "in" ? "Money in" : "Money out"}
            </button>
          ))}
        </div>
      }>
        {tx.length === 0 ? <p className="text-[12px] text-text-muted m-0">Nothing here yet.</p> : (
          <ul className="m-0 p-0 list-none grid gap-0">
            {tx.map((t, i) => (
              <li key={`${t.kind}-${t.date}-${i}`} data-testid={`tx-${t.direction}`} className="flex items-center gap-2 py-1.5 border-b border-border last:border-b-0 text-[12px]">
                {t.direction === "in"
                  ? <ArrowDownLeft size={14} className="text-[#0E9F6E] shrink-0" aria-label="Money in" />
                  : <ArrowUpRight size={14} className="text-[#DC2626] shrink-0" aria-label="Money out" />}
                <span className="text-text-muted w-12 shrink-0">{shortDate(t.date)}</span>
                <span className="flex-1 min-w-0 break-words text-text-soft">{t.label}</span>
                <span className="font-semibold shrink-0">{t.direction === "in" ? "+" : "−"}{formatNaira(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Insights */}
      <Card title="What to do next" testId="insights-section">
        <div className="grid gap-2.5">
          {insights.map(i => <InsightCard key={i.id} insight={i} />)}
        </div>
      </Card>
    </div>
  );
}
