import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeAll, snapshotOf, type FinBooking, type FinanceInput } from "../../../lib/finance";
import { generateInsights } from "../../../lib/financeInsights";
import type { FinanceState } from "../../../hooks/useFinances";

const NOW = Date.parse("2026-11-07T11:00:00Z");
const fin = vi.hoisted(() => ({ state: null as unknown as FinanceState }));
vi.mock("../../../hooks/useFinances", () => ({ useFinances: () => fin.state, OPEN_MONTH_KEY: "nessy_finances_open_month" }));
vi.mock("../../../hooks/useServices", () => ({ useServices: () => ({ services: [{ cat: "Styling", items: [] }, { cat: "Treatments", items: [] }] }) }));
vi.mock("../../../context/ThemeContext", () => ({ useTheme: () => ({ isDark: false, t: { gold: "#C49A6C" } }) }));

import { Finances } from "./Finances";
import { BusinessCostsSettings } from "./BusinessCostsSettings";

let seq = 0;
const bk = (over: Partial<FinBooking> & { date: string }): FinBooking => ({
  id: `b${++seq}`, clientName: `Client ${seq}`, time: "10:00 AM", status: "completed", quotedPrice: 30000, attachmentPreference: null,
  attachmentItems: [], accessoryItems: [], hairServiceCost: null, depositConfirmedAt: null, balancePaidAt: null, productCost: 3000, category: "Styling", ...over,
});

function makeState(over: Partial<FinanceState> = {}): FinanceState {
  const a = bk({ date: "2026-10-20", clientName: "Ngozi" });
  const input: FinanceInput = {
    bookings: [a, bk({ date: "2026-10-20", time: "2:00 PM" }), bk({ date: "2026-10-25", productCost: null }), bk({ date: "2026-11-02", clientName: "Bisi" })],
    payments: [
      { bookingId: a.id, kind: "deposit", amount: 15000, receivedAt: "2026-10-18T10:00:00Z", source: "app" },
    ],
    rates: [{ kind: "staff_salary", amount: 30000, effectiveFrom: "2000-01-01" }, { kind: "transport_daily", amount: 1500, effectiveFrom: "2000-01-01" }],
    expenses: [{ id: "e1", date: "2026-11-03", category: "Equipment & tools", amount: 25000, note: "Dryer" }],
    recurring: [], trackingStart: "2026-10-14", depositPercentage: 50, now: NOW,
  };
  const all = computeAll(input);
  const oct = all.months[0];
  // October was closed with Ngozi's balance still unpaid and one product cost missing … then both changed.
  const closedSnapshot = { ...snapshotOf(oct), collected: oct.collected - 15000, outstanding: oct.outstanding + 15000 };
  return {
    loading: false, error: null,
    rows: { bookings: [], services: [], payments: [], rates: [], expenses: [{ id: "e1", expense_date: "2026-11-03", category: "Equipment & tools", amount: 25000, note: "Dryer", created_at: "" }], recurring: [], config: [], depositPercentage: 50 },
    months: all.months, totals: all.totals,
    insightsByMonth: new Map(all.months.map((m, i) => [m.month, generateInsights(m, i ? all.months[i - 1] : null)])),
    reports: new Map([["2026-10", { month: "2026-10", figures: closedSnapshot, insights: [], closedAt: "2026-11-01T01:00:00Z" }]]),
    trackingStart: "2026-10-14", trackingStartConfirmed: true,
    earliestBookings: [
      { id: "t0", firstName: "Test", createdDate: "2026-10-13", createdTime: "21:05", appointmentDate: "2026-10-14", status: "cancelled" },
      { id: "b1", firstName: "Ngozi", createdDate: "2026-10-14", createdTime: "09:12", appointmentDate: "2026-10-20", status: "completed" },
    ],
    categoryCosts: new Map([["Styling", 4000]]),
    refetch: vi.fn(), addExpense: vi.fn(async () => {}), updateExpense: vi.fn(async () => {}), deleteExpense: vi.fn(async () => {}),
    addRecurring: vi.fn(async () => {}), stopRecurring: vi.fn(async () => {}), setRate: vi.fn(async () => {}), setTrackingStart: vi.fn(async () => {}),
    setCategoryCost: vi.fn(async () => {}), setProductCost: vi.fn(async () => {}), recordRefund: vi.fn(async () => {}),
    ...over,
  };
}

beforeEach(() => { fin.state = makeState(); });

describe("Finances overview", () => {
  it("shows all-time totals, the chart, and months newest first with a part-month badge", () => {
    render(<Finances />);
    const overview = screen.getByTestId("finance-overview");
    expect(within(overview).getByText("Since 14 Oct 2026")).toBeInTheDocument();
    expect(within(overview).getAllByTestId("profit-loss")[0].textContent).toMatch(/^(Profit|Loss) ₦/);
    expect(screen.getByTestId("finance-chart")).toBeInTheDocument();
    const cards = screen.getAllByRole("button").filter(b => b.dataset.testid?.startsWith("month-card-"));
    expect(cards.map(c => c.dataset.testid)).toEqual(["month-card-2026-11", "month-card-2026-10"]);
    expect(within(cards[1]).getByText("Part month")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Month to date")).toBeInTheDocument();
    expect(within(cards[1]).getByText(/3 appointments · 2 hair days/)).toBeInTheDocument();
  });

  it("shows money received (cash in by payment date) on the overview and each month card", () => {
    render(<Finances />);
    expect(within(screen.getByTestId("finance-overview")).getByText("Money received")).toBeInTheDocument();
    expect(within(screen.getByTestId("month-card-2026-10")).getByTestId("month-card-received")).toHaveTextContent("Money received in October: ₦15,000");
  });

  it("asks to choose the tracking start while it isn't confirmed", () => {
    fin.state = makeState({ trackingStartConfirmed: false });
    render(<Finances />);
    expect(screen.getByTestId("tracking-start-banner")).toHaveTextContent("Settings → Business costs");
  });

  it("flags bookings missing a product cost", () => {
    render(<Finances />);
    expect(screen.getByTestId("missing-product-costs-banner")).toHaveTextContent("1 booking missing product cost");
  });
});

describe("Month report", () => {
  const openOctober = () => {
    render(<Finances />);
    fireEvent.click(screen.getByTestId("month-card-2026-10"));
    return screen.getByTestId("month-report");
  };

  it("summarises the month, with the launch-month salary note", () => {
    const report = openOctober();
    expect(within(report).getByText("October 2026")).toBeInTheDocument();
    expect(within(screen.getByTestId("month-summary")).getByText(/Part month: live from 14 Oct, salary prorated 18\/31/)).toBeInTheDocument();
    expect(within(screen.getByTestId("month-summary")).getByText("Part month")).toBeInTheDocument();
  });

  it("explains each cost line in plain words", () => {
    openOctober();
    const costs = screen.getByTestId("costs-section");
    expect(within(costs).getByText("2 days × ₦1,500")).toBeInTheDocument();
    expect(within(costs).getByText(/2 bookings,/)).toBeInTheDocument();
    expect(within(costs).getByRole("button", { name: "1 missing" })).toBeInTheDocument();
  });

  it("lists who still owes", () => {
    openOctober();
    const unpaid = screen.getByTestId("unpaid-list");
    expect(within(unpaid).getByText(/Ngozi/)).toBeInTheDocument();
    expect(within(unpaid).getByText("₦15,000 owed")).toBeInTheDocument();
  });

  it("says what changed since the report was closed", () => {
    openOctober();
    const box = screen.getByTestId("updated-since-close");
    expect(box).toHaveTextContent("Updated since this report was closed on 1 Nov");
    expect(box).toHaveTextContent(/Collected: ₦\d[\d,]* → ₦/);
  });

  it("shows money received in the month separately from Earned and Collected", () => {
    openOctober();
    const box = screen.getByTestId("money-received");
    expect(box).toHaveTextContent("Money received in October");
    expect(box).toHaveTextContent("₦15,000");
    expect(box).toHaveTextContent(/not the same as Earned/);
  });

  it("filters transactions by money in / out", () => {
    openOctober();
    const tx = screen.getByTestId("transactions-section");
    const ins = () => within(tx).queryAllByTestId("tx-in").length;
    const outs = () => within(tx).queryAllByTestId("tx-out").length;
    expect(ins()).toBeGreaterThan(0);
    expect(outs()).toBeGreaterThan(0);
    fireEvent.click(within(tx).getByRole("button", { name: "Money in" }));
    expect(outs()).toBe(0);
    fireEvent.click(within(tx).getByRole("button", { name: "Money out" }));
    expect(ins()).toBe(0);
  });

  it("shows 3–6 insights", () => {
    openOctober();
    const n = within(screen.getByTestId("insights-section")).getAllByTestId("insight").length;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(6);
  });
});

describe("Expenses", () => {
  it("adds an expense", async () => {
    render(<Finances />);
    fireEvent.click(screen.getByRole("tab", { name: "Expenses" }));
    expect(screen.getAllByTestId("expense-row")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Add expense/ }));
    const form = screen.getByTestId("expense-form");
    fireEvent.change(within(form).getByLabelText("Category"), { target: { value: "Training" } });
    fireEvent.change(within(form).getByPlaceholderText("amount"), { target: { value: "15000" } });
    fireEvent.change(within(form).getByPlaceholderText("e.g. New dryer"), { target: { value: "Braiding course" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add expense" }));
    await vi.waitFor(() => expect(fin.state.addExpense).toHaveBeenCalledWith(expect.objectContaining({ category: "Training", amount: 15000, note: "Braiding course" })));
  });
});

describe("Business costs settings", () => {
  it("changing a rate asks 'Effective from', defaulting to the 1st of next month", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    fin.state = makeState({ rows: { ...makeState().rows!, rates: [
      { id: "r1", kind: "staff_salary", amount: 30000, effective_from: "2000-01-01", created_at: "" },
      { id: "r2", kind: "transport_daily", amount: 1500, effective_from: "2000-01-01", created_at: "" },
    ] } });
    try {
      render(<BusinessCostsSettings />);
      const salary = screen.getByTestId("rate-staff_salary");
      expect(salary).toHaveTextContent("₦30,000");
      fireEvent.click(within(salary).getByRole("button", { name: "Change" }));
      expect(within(salary).getByLabelText("Effective from")).toHaveValue("2026-12-01");
      fireEvent.click(within(salary).getByRole("button", { name: "Save" }));
      await vi.waitFor(() => expect(fin.state.setRate).toHaveBeenCalledWith("staff_salary", 30000, "2026-12-01"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("lists the earliest bookings next to the tracking start, and 'Use this date' fills it in", () => {
    fin.state = makeState({ trackingStartConfirmed: false });
    render(<BusinessCostsSettings />);
    expect(screen.getByTestId("tracking-start-unconfirmed")).toBeInTheDocument();
    const list = screen.getByTestId("earliest-bookings");
    expect(list).toHaveTextContent("13 Oct 2026, 21:05 · Test · appt 14 Oct · cancelled");
    fireEvent.click(within(list).getAllByRole("button", { name: "Use this date" })[1]);
    expect(screen.getByLabelText("Tracking start date")).toHaveValue("2026-10-14");
  });
});
