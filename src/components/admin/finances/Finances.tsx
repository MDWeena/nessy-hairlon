import { useState } from "react";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { OPEN_MONTH_KEY, useFinances } from "../../../hooks/useFinances";
import { formatNaira, shortDate, type MonthFigures } from "../../../lib/finance";
import { LoadingNotice } from "../../ui/LoadingNotice";
import { ErrorNotice } from "../../ui/ErrorNotice";
import { Sheet } from "../../ui/Sheet";
import { FinanceChart } from "./FinanceChart";
import { MonthReport } from "./MonthReport";
import { ExpensesPanel } from "./ExpensesPanel";
import { MissingProductCosts } from "./MissingProductCosts";
import { Badge, Card, Line, ProfitLoss, Stat } from "./parts";

function readOpenMonth(): string | null {
  try {
    const m = sessionStorage.getItem(OPEN_MONTH_KEY);
    sessionStorage.removeItem(OPEN_MONTH_KEY);
    return m;
  } catch {
    return null;
  }
}

function MonthCard({ m, onOpen }: { m: MonthFigures; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} data-testid={`month-card-${m.month}`}
      className="w-full text-left bg-surface border border-border rounded-xl p-4 cursor-pointer flex items-center gap-3 hover-lift min-h-11">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-text">{m.label}</span>
          {m.isCurrent && <Badge tone="info">Month to date</Badge>}
          {m.isLaunchPartial && <Badge tone="gold">Part month</Badge>}
        </div>
        <div className="text-[13px] mt-1"><ProfitLoss value={m.profit} /></div>
        <div className="text-[12px] text-text-muted mt-0.5">
          {m.appointments} appointment{m.appointments === 1 ? "" : "s"} · {m.workingDays} working day{m.workingDays === 1 ? "" : "s"}
          {m.costs.productsMissing > 0 && ` · ${m.costs.productsMissing} missing product cost`}
        </div>
      </div>
      <ChevronRight size={18} className="text-text-muted shrink-0" aria-hidden="true" />
    </button>
  );
}

export function Finances() {
  const fin = useFinances();
  const [tab, setTab] = useState<"overview" | "expenses">("overview");
  const [openMonth, setOpenMonth] = useState<string | null>(() => readOpenMonth());
  const [fillMonth, setFillMonth] = useState<string | "all" | null>(null);

  if (fin.loading) return <LoadingNotice label="Loading finances…" />;
  if (fin.error || !fin.totals) return <ErrorNotice message={fin.error ?? "Couldn't load the finance data."} />;

  const months = fin.months;
  const selected = openMonth ? months.find(m => m.month === openMonth) ?? null : null;
  const t = fin.totals;

  const fillSheet = fillMonth && (
    <Sheet title="Add missing product costs" onClose={() => setFillMonth(null)}>
      <MissingProductCosts fin={fin} month={fillMonth === "all" ? null : fillMonth} />
    </Sheet>
  );

  if (selected) {
    return (
      <>
        <MonthReport
          month={selected} insights={fin.insightsByMonth.get(selected.month) ?? []} report={fin.reports.get(selected.month) ?? null}
          onBack={() => setOpenMonth(null)} onFillProductCosts={(m) => setFillMonth(m)} onRecordRefund={fin.recordRefund}
        />
        {fillSheet}
      </>
    );
  }

  return (
    <div data-testid="finances">
      <div role="tablist" aria-label="Finances" className="flex gap-1.5 mb-4">
        {(["overview", "expenses"] as const).map(k => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
            className={`py-[7px] px-4 rounded-full text-xs cursor-pointer border min-h-11 md:min-h-0 ${tab === k ? "border-gold bg-gold-bg text-gold font-bold" : "border-border bg-transparent text-text-soft font-medium"}`}>
            {k === "overview" ? "Overview" : "Expenses"}
          </button>
        ))}
      </div>

      {tab === "expenses" ? <ExpensesPanel fin={fin} months={months.map(m => m.month)} /> : (
        <>
          {t.productsMissing > 0 && (
            <button type="button" onClick={() => setFillMonth("all")} data-testid="missing-product-costs-banner"
              className="w-full text-left rounded-xl border border-[#F59E0B40] bg-[#F59E0B10] p-3 mb-4 flex items-center gap-2 cursor-pointer text-[13px] text-text min-h-11">
              <AlertTriangle size={16} className="text-[#B45309] shrink-0" aria-hidden="true" />
              <span className="flex-1"><strong>{t.productsMissing} booking{t.productsMissing === 1 ? "" : "s"} missing product cost.</strong> They count as ₦0 until filled in, so profit looks a little better than it is.</span>
              <span className="text-gold font-semibold shrink-0">Fill in</span>
            </button>
          )}

          <Card title={`Since ${fin.trackingStart ? `${shortDate(fin.trackingStart)} ${fin.trackingStart.slice(0, 4)}` : "launch"}`} testId="finance-overview">
            <div className="mb-3"><ProfitLoss value={t.profit} className="text-2xl" /></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <Stat label="Earned" value={formatNaira(t.earned)} sub={t.keptDeposits ? `+ ${formatNaira(t.keptDeposits)} kept deposits` : undefined} />
              <Stat label="Collected" value={formatNaira(t.collected)} />
              <Stat label="Outstanding" value={formatNaira(t.outstanding)} />
              <Stat label="Total costs" value={formatNaira(t.costs.total)} />
            </div>
            <Line label="Products used" value={formatNaira(t.costs.products)} />
            <Line label="Materials bought for clients" value={formatNaira(t.costs.materials)} />
            <Line label="Transport" value={formatNaira(t.costs.transport)} />
            <Line label="Staff salary" value={formatNaira(t.costs.salary)} />
            <Line label="Other expenses" value={formatNaira(t.costs.otherExpenses)} />
            <p className="text-[11px] text-text-muted mt-2 mb-0">Cash basis (money actually in): {t.cashProfit >= 0 ? "profit" : "loss"} {formatNaira(Math.abs(t.cashProfit))}</p>
          </Card>

          <Card title="Revenue vs costs">
            <FinanceChart months={months} />
          </Card>

          <h3 className="text-[15px] font-bold mt-6 mb-2.5">Months</h3>
          <div className="grid gap-2.5">
            {[...months].reverse().map(m => <MonthCard key={m.month} m={m} onOpen={() => setOpenMonth(m.month)} />)}
          </div>
        </>
      )}
      {fillSheet}
    </div>
  );
}
