import { describe, expect, it } from "vitest";
import {
  changesSinceClose, computeAll, computeMonth, formatNaira, isEarned, monthsToClose, paymentsFor, rateOn, snapshotOf,
  type FinBooking, type FinanceInput, type LedgerPayment, type RateEntry,
} from "./finance";
import { generateInsights, leadInsight, breakEvenInsight, categoryInsights, transportInsight, salaryInsight, outstandingInsight, monthOverMonthInsight, dataGapInsight } from "./financeInsights";

// "Now" = 7 Nov 2026, 12:00 WAT (11:00 UTC). Launch: 14 Oct 2026.
const NOW = Date.parse("2026-11-07T11:00:00Z");
let seq = 0;
function bk(over: Partial<FinBooking> & { date: string }): FinBooking {
  return {
    id: `b${++seq}`, clientName: `Client ${seq}`, time: "10:00 AM", status: "completed", quotedPrice: 30000,
    attachmentPreference: null, attachmentItems: [], accessoryItems: [], hairServiceCost: null,
    depositConfirmedAt: null, balancePaidAt: null, productCost: 3000, category: "Braiding", ...over,
  };
}
const RATES: RateEntry[] = [
  { kind: "staff_salary", amount: 30000, effectiveFrom: "2000-01-01" },
  { kind: "transport_daily", amount: 1500, effectiveFrom: "2000-01-01" },
];
function input(over: Partial<FinanceInput> = {}): FinanceInput {
  return { bookings: [], payments: [], rates: RATES, expenses: [], recurring: [], trackingStart: "2026-10-14", depositPercentage: 50, now: NOW, ...over };
}
const pay = (bookingId: string, kind: LedgerPayment["kind"], amount: number, at = "2026-10-20T10:00:00Z", source: LedgerPayment["source"] = "app"): LedgerPayment =>
  ({ bookingId, kind, amount, receivedAt: at, source });

describe("rule 1: month attribution (Africa/Lagos, by appointment date)", () => {
  it("puts appointments on the last/first day of a month in that month", () => {
    const a = bk({ date: "2026-10-31", time: "4:00 PM" }), b = bk({ date: "2026-11-01", time: "10:00 AM" });
    const i = input({ bookings: [a, b] });
    expect(computeMonth(i, "2026-10").appointments).toBe(1);
    expect(computeMonth(i, "2026-11").appointments).toBe(1);
  });

  it("uses the appointment month, not the payment month", () => {
    const a = bk({ date: "2026-10-30" });
    const i = input({ bookings: [a], payments: [pay(a.id, "deposit", 15000, "2026-10-01T09:00:00Z"), pay(a.id, "balance", 15000, "2026-11-03T09:00:00Z")] });
    expect(computeMonth(i, "2026-10").collected).toBe(30000);
    expect(computeMonth(i, "2026-11").collected).toBe(0);
  });

  it("is independent of the machine's timezone: 23:30 UTC on 31 Oct is already 1 Nov in Lagos", () => {
    const b = bk({ date: "2026-11-01", time: "10:00 AM", status: "confirmed" });
    expect(isEarned(b, Date.parse("2026-10-31T23:30:00Z"))).toBe(false);
    expect(computeMonth(input({ bookings: [b], now: Date.parse("2026-10-31T23:30:00Z") }), "2026-11").isCurrent).toBe(true);
  });

  it("ignores bookings before the tracking start", () => {
    expect(computeMonth(input({ bookings: [bk({ date: "2026-10-10" })] }), "2026-10").appointments).toBe(0);
  });
});

describe("rule 2: what counts as earned", () => {
  it("counts completed, and confirmed only once its start time has passed", () => {
    const done = bk({ date: "2026-11-02" });
    const pastConfirmed = bk({ date: "2026-11-07", time: "11:00 AM", status: "confirmed" });
    const laterToday = bk({ date: "2026-11-07", time: "4:00 PM", status: "confirmed" });
    const others = (["pending_review", "quoted", "deposit_paid", "cancelled"] as const).map(status => bk({ date: "2026-11-03", status }));
    const m = computeMonth(input({ bookings: [done, pastConfirmed, laterToday, ...others] }), "2026-11");
    expect(m.appointments).toBe(2);
    expect(m.earned).toBe(60000);
  });

  it("uses the full agreed price, materials included", () => {
    const b = bk({ date: "2026-11-02", quotedPrice: 80000, attachmentPreference: "nessy_buys", hairServiceCost: 30000,
      attachmentItems: [{ quantity: 3, unitCost: 10000 }] });
    const m = computeMonth(input({ bookings: [b] }), "2026-11");
    expect(m.earned).toBe(80000);
    expect(m.costs.materials).toBe(30000);
  });
});

describe("rule 3: collected vs outstanding", () => {
  it("splits each month's earned into collected and outstanding, listing who owes", () => {
    const paid = bk({ date: "2026-11-02", clientName: "Ada" });
    const half = bk({ date: "2026-11-03", clientName: "Bola" });
    const none = bk({ date: "2026-11-04", clientName: "Chi", quotedPrice: 20000 });
    const m = computeMonth(input({
      bookings: [paid, half, none],
      payments: [pay(paid.id, "deposit", 15000), pay(paid.id, "balance", 15000), pay(half.id, "deposit", 15000)],
    }), "2026-11");
    expect(m.earned).toBe(80000);
    expect(m.collected).toBe(45000);
    expect(m.outstanding).toBe(35000);
    expect(m.unpaid.map(u => [u.clientName, u.owed])).toEqual([["Bola", 15000], ["Chi", 20000]]);
  });
});

describe("rule 4: kept deposits on cancelled bookings", () => {
  it("counts a confirmed deposit on a cancelled booking in the original appointment's month", () => {
    const c = bk({ date: "2026-10-25", status: "cancelled" });
    const m = computeMonth(input({ bookings: [c], payments: [pay(c.id, "deposit", 15000, "2026-10-01T10:00:00Z")] }), "2026-10");
    expect(m.keptDeposits).toBe(15000);
    expect(m.earned).toBe(0);
    expect(m.profit).toBe(15000 - m.costs.total);
  });

  it("nets out a recorded refund", () => {
    const c = bk({ date: "2026-10-25", status: "cancelled" });
    const m = computeMonth(input({ bookings: [c], payments: [pay(c.id, "deposit", 15000), pay(c.id, "refund", 15000)] }), "2026-10");
    expect(m.keptDeposits).toBe(0);
  });

  it("falls back to the deposit timestamp when there's no ledger row", () => {
    const c = bk({ date: "2026-10-25", status: "cancelled", depositConfirmedAt: "2026-10-01T10:00:00Z" });
    expect(computeMonth(input({ bookings: [c] }), "2026-10").keptDeposits).toBe(15000);
  });
});

describe("rule 5c: transport — one fare per distinct working day", () => {
  it("charges three bookings on one day once", () => {
    const day = "2026-11-03";
    const m = computeMonth(input({ bookings: [bk({ date: day, time: "10:00 AM" }), bk({ date: day, time: "1:00 PM" }), bk({ date: day, time: "4:00 PM" }), bk({ date: "2026-11-04" })] }), "2026-11");
    expect(m.workingDays).toBe(2);
    expect(m.costs.transport).toBe(3000);
    expect(m.costs.transportDays.map(d => d.appointments)).toEqual([3, 1]);
  });

  it("ignores days with only non-earned bookings", () => {
    const m = computeMonth(input({ bookings: [bk({ date: "2026-11-03", status: "cancelled" }), bk({ date: "2026-11-20", status: "confirmed" })] }), "2026-11");
    expect(m.costs.transport).toBe(0);
  });
});

describe("rules 5d and 6: salary proration and rate history", () => {
  it("prorates the launch month and labels it", () => {
    const m = computeMonth(input(), "2026-10");
    expect(m.isLaunchPartial).toBe(true);
    expect(m.daysCounted).toBe(18);
    expect(m.costs.salary).toBe(Math.round(30000 * 18 / 31));
    expect(m.costs.salaryNote).toContain("Part month: live from 14 Oct, salary prorated 18/31");
  });

  it("charges a full month afterwards, and month-to-date for the current month", () => {
    const past = computeMonth(input({ now: Date.parse("2026-12-05T11:00:00Z") }), "2026-11");
    expect(past.costs.salary).toBe(30000);
    const current = computeMonth(input(), "2026-11");
    expect(current.daysCounted).toBe(7);
    expect(current.costs.salary).toBe(Math.round(30000 * 7 / 30));
    expect(current.costs.salaryNote).toContain("Month to date: 7 of 30 days");
  });

  it("a rate change applies from its effective date only — past months keep the old rate", () => {
    const rates: RateEntry[] = [...RATES, { kind: "transport_daily", amount: 2000, effectiveFrom: "2026-10-20" }, { kind: "staff_salary", amount: 60000, effectiveFrom: "2026-12-01" }];
    const m = computeMonth(input({ rates, bookings: [bk({ date: "2026-10-19" }), bk({ date: "2026-10-20" })] }), "2026-10");
    expect(m.costs.transportDays.map(d => d.rate)).toEqual([1500, 2000]);
    expect(m.costs.salary).toBe(Math.round(30000 * 18 / 31));
    expect(rateOn(rates, "staff_salary", "2026-11-30")).toBe(30000);
    expect(rateOn(rates, "staff_salary", "2026-12-01")).toBe(60000);
  });

  it("a mid-month salary change is split by day", () => {
    const rates: RateEntry[] = [...RATES, { kind: "staff_salary", amount: 62000, effectiveFrom: "2026-11-16" }];
    const m = computeMonth(input({ rates, now: Date.parse("2026-12-05T11:00:00Z") }), "2026-11");
    expect(m.costs.salary).toBe(Math.round(30000 * 15 / 30 + 62000 * 15 / 30));
  });
});

describe("rule 5e and 8: other expenses", () => {
  it("adds one-off expenses dated in the month, and recurring ones per day active", () => {
    const m = computeMonth(input({
      now: Date.parse("2026-12-05T11:00:00Z"),
      expenses: [{ id: "e1", date: "2026-11-10", category: "Equipment & tools", amount: 12000, note: "Dryer" }, { id: "e2", date: "2026-12-01", category: "Other", amount: 999, note: null }],
      recurring: [{ id: "r1", category: "Rent & utilities", amount: 30000, note: "Shop", startDate: "2026-11-16", endDate: null }],
    }), "2026-11");
    expect(m.costs.oneOffExpenses).toBe(12000);
    expect(m.costs.recurringExpenses).toBe(15000);
  });
});

describe("rule 7: product costs, including missing ones", () => {
  it("sums product costs and flags missing ones as ₦0", () => {
    const m = computeMonth(input({ bookings: [bk({ date: "2026-11-02", productCost: 4000 }), bk({ date: "2026-11-03", productCost: null }), bk({ date: "2026-11-04", productCost: 0 })] }), "2026-11");
    expect(m.costs.products).toBe(4000);
    expect(m.costs.productsMissing).toBe(1);
    expect(m.costs.productBookings).toBe(2);
  });
});

describe("rule 10: ledger vs backfill vs derived", () => {
  it("uses the ledger amount even after the price was edited later", () => {
    const b = bk({ date: "2026-11-02", quotedPrice: 30000, depositConfirmedAt: "2026-10-30T10:00:00Z" });
    const pays = paymentsFor(b, [pay(b.id, "deposit", 15000, "2026-10-30T10:00:00Z")], 50);
    expect(pays).toEqual([{ kind: "deposit", amount: 15000, receivedAt: "2026-10-30T10:00:00Z", origin: "ledger" }]);
  });

  it("marks backfilled rows, and derives from timestamps only when there's no ledger row", () => {
    const b = bk({ date: "2026-11-02", depositConfirmedAt: "2026-10-30T10:00:00Z", balancePaidAt: "2026-11-02T15:00:00Z" });
    expect(paymentsFor(b, [pay(b.id, "deposit", 15000, "2026-10-30T10:00:00Z", "backfill")], 50)[0].origin).toBe("backfill");
    expect(paymentsFor(b, [], 50)).toEqual([
      { kind: "deposit", amount: 15000, receivedAt: "2026-10-30T10:00:00Z", origin: "derived" },
      { kind: "balance", amount: 15000, receivedAt: "2026-11-02T15:00:00Z", origin: "derived" },
    ]);
  });
});

describe("rule 9: profit, margin and cash profit", () => {
  it("profit = earned + kept − costs; cash = collected + kept − costs", () => {
    const a = bk({ date: "2026-11-02", productCost: 3000 });
    const c = bk({ date: "2026-11-05", status: "cancelled" });
    const i = input({
      now: Date.parse("2026-12-05T11:00:00Z"), bookings: [a, c],
      payments: [pay(a.id, "deposit", 15000), pay(c.id, "deposit", 15000)],
      expenses: [{ id: "e1", date: "2026-11-10", category: "Data & phone", amount: 5000, note: null }],
    });
    const m = computeMonth(i, "2026-11");
    const costs = 3000 + 1500 + 30000 + 5000;
    expect(m.costs.total).toBe(costs);
    expect(m.profit).toBe(30000 + 15000 - costs);
    expect(m.cashProfit).toBe(15000 + 15000 - costs);
    expect(m.margin).toBeCloseTo((45000 - costs) / 45000);
  });

  it("all-time totals add up across months", () => {
    const i = input({ bookings: [bk({ date: "2026-10-20" }), bk({ date: "2026-11-02" })] });
    const { months, totals } = computeAll(i);
    expect(months.map(m => m.month)).toEqual(["2026-10", "2026-11"]);
    expect(totals.earned).toBe(60000);
    expect(totals.profit).toBe(months[0].profit + months[1].profit);
  });
});

describe("weeks inside a month (Mon–Sun, clipped)", () => {
  it("splits November 2026 into Mon–Sun weeks clipped to the month", () => {
    const m = computeMonth(input({ now: Date.parse("2026-12-05T11:00:00Z"), bookings: [bk({ date: "2026-11-01" }), bk({ date: "2026-11-02" })] }), "2026-11");
    expect(m.weeks.map(w => [w.start, w.end])).toEqual([
      ["2026-11-01", "2026-11-01"], ["2026-11-02", "2026-11-08"], ["2026-11-09", "2026-11-15"],
      ["2026-11-16", "2026-11-22"], ["2026-11-23", "2026-11-29"], ["2026-11-30", "2026-11-30"],
    ]);
    expect(m.weeks[0].appointments).toBe(1);
    expect(m.weeks[1].earned).toBe(30000);
  });
});

describe("month close", () => {
  it("lists finished months without a report", () => {
    expect(monthsToClose(input(), [])).toEqual(["2026-10"]);
    expect(monthsToClose(input(), ["2026-10"])).toEqual([]);
  });

  it("detects what changed since the report was closed", () => {
    const a = bk({ date: "2026-10-20", productCost: null });
    const closed = snapshotOf(computeMonth(input({ bookings: [a] }), "2026-10"));
    const later = computeMonth(input({ bookings: [{ ...a, productCost: 2500 }], payments: [pay(a.id, "balance", 30000, "2026-11-03T10:00:00Z")] }), "2026-10");
    const changes = changesSinceClose(closed, later);
    expect(changes.map(c => c.field)).toEqual(expect.arrayContaining(["collected", "outstanding", "products", "productsMissing", "profit"]));
    expect(changes.find(c => c.field === "collected")?.display).toBe("Collected: ₦0 → ₦30,000");
    expect(changesSinceClose(snapshotOf(later), later)).toEqual([]);
  });
});

describe("formatNaira", () => {
  it("formats with a real minus sign for losses", () => {
    expect(formatNaira(50000)).toBe("₦50,000");
    expect(formatNaira(-1234.6)).toBe("−₦1,235");
  });
});

// ─── Insights ───────────────────────────────────────────────────────────────────────────────

const LATER = Date.parse("2026-12-05T11:00:00Z");
function month(bookings: FinBooking[], over: Partial<FinanceInput> = {}, which = "2026-11") {
  return computeMonth(input({ now: LATER, bookings, ...over }), which);
}

describe("insights", () => {
  it("loss month leads with what would have made a profit", () => {
    const m = month([bk({ date: "2026-11-03" })]);
    expect(m.profit).toBeLessThan(0);
    const lead = leadInsight(m, null)!;
    expect(lead.title).toMatch(/short of a profit/);
    expect(lead.body).toMatch(/more booking.* at your average price of ₦30,000/);
    expect(lead.body).toMatch(/average price about ₦\d/);
    expect(lead.body).not.toMatch(/fail|bad|terrible|disaster/i);
  });

  it("profit month leads with what drove it", () => {
    const many = Array.from({ length: 6 }, (_, i) => bk({ date: `2026-11-${String(3 + i).padStart(2, "0")}`, quotedPrice: 20000, productCost: 2000 }));
    const prev = month([bk({ date: "2026-10-20", quotedPrice: 20000 })], {}, "2026-10");
    const m = month(many);
    expect(m.profit).toBeGreaterThan(0);
    const lead = leadInsight(m, prev)!;
    expect(lead.tone).toBe("good");
    expect(lead.body).toMatch(/more appointments than last month/);
  });

  it("break-even: fixed costs ÷ what each booking leaves", () => {
    const m = month([bk({ date: "2026-11-03", quotedPrice: 30000, productCost: 3000 })]);
    const be = breakEvenInsight(m)!;
    // 30,000 − 3,000 products − 1,500 transport = 25,500 per booking; 30,000 / 25,500 → 2
    expect(be.title).toBe("Break-even: about 2 bookings a month");
    expect(be.body).toMatch(/You did 1/);
  });

  it("flags categories where products exceed ~40% of the price, and names the best/worst", () => {
    const m = month([
      bk({ date: "2026-11-03", category: "Braiding", quotedPrice: 40000, productCost: 4000 }),
      bk({ date: "2026-11-04", category: "Treatments", quotedPrice: 10000, productCost: 5000 }),
    ]);
    const ins = categoryInsights(m);
    expect(ins[0].title).toBe("Braiding earns you the most per booking");
    expect(ins.find(i => i.id === "product_share_Treatments")?.title).toBe("Products take 50% of Treatments prices");
    expect(ins.some(i => i.id === "product_share_Braiding")).toBe(false);
  });

  it("transport: counts single-appointment days and their cost", () => {
    const m = month([bk({ date: "2026-11-03" }), bk({ date: "2026-11-04", time: "10:00 AM" }), bk({ date: "2026-11-04", time: "2:00 PM" })]);
    expect(transportInsight(m)!.title).toBe("1 day with just one appointment");
    expect(transportInsight(m)!.body).toContain("₦1,500");
  });

  it("salary load as a share of revenue, with the trend", () => {
    const prev = month([bk({ date: "2026-10-20", quotedPrice: 30000 })], {}, "2026-10");
    const m = month([bk({ date: "2026-11-03", quotedPrice: 100000 }), bk({ date: "2026-11-04", quotedPrice: 100000 })]);
    const s = salaryInsight(m, prev)!;
    expect(s.title).toBe("Salary is 15% of income");
    expect(s.body).toMatch(/down from 58% last month/);
  });

  it("outstanding balances with the list", () => {
    const m = month([bk({ date: "2026-11-03", clientName: "Bola" })]);
    const o = outstandingInsight(m)!;
    expect(o.title).toBe("₦30,000 still to collect");
    expect(o.figures).toEqual([{ label: "Bola", value: "₦30,000" }]);
  });

  it("month over month", () => {
    const prev = month([bk({ date: "2026-10-20", quotedPrice: 20000 })], {}, "2026-10");
    const m = month([bk({ date: "2026-11-03", quotedPrice: 30000 }), bk({ date: "2026-11-04", quotedPrice: 30000 })]);
    const mom = monthOverMonthInsight(m, prev)!;
    expect(mom.body).toMatch(/Income up 200%, bookings up 100%, average price up 50%/);
  });

  it("data gaps: missing product costs", () => {
    const m = month([bk({ date: "2026-11-03", productCost: null }), bk({ date: "2026-11-04", productCost: null })]);
    expect(dataGapInsight(m)!.title).toBe("2 bookings missing a product cost");
  });

  it("always 3–6 insights, lead first", () => {
    for (const bookings of [[], [bk({ date: "2026-11-03" })], Array.from({ length: 12 }, (_, i) => bk({ date: `2026-11-${String(2 + i).padStart(2, "0")}`, productCost: i % 3 ? 2000 : null, category: i % 2 ? "Braiding" : "Locs", quotedPrice: 20000 + i * 1000 }))]) {
      const ins = generateInsights(month(bookings), null);
      expect(ins.length).toBeGreaterThanOrEqual(3);
      expect(ins.length).toBeLessThanOrEqual(6);
      expect(ins[0].id).toBe("lead");
      for (const i of ins) expect(i.figures.length).toBeGreaterThan(0);
    }
  });
});

describe("money received this month (cash in, by received date)", () => {
  it("counts each payment in the month it arrived, whatever the appointment month", () => {
    const oct = bk({ date: "2026-10-25" });                          // balance arrives in November
    const nov = bk({ date: "2026-11-20", status: "confirmed" });     // deposit paid in October, not yet earned
    const gone = bk({ date: "2026-10-28", status: "cancelled" });    // deposit in Oct, refunded in Nov
    const i = input({
      bookings: [oct, nov, gone],
      payments: [
        pay(oct.id, "deposit", 15000, "2026-10-20T10:00:00Z"), pay(oct.id, "balance", 15000, "2026-11-02T10:00:00Z"),
        pay(nov.id, "deposit", 15000, "2026-10-31T22:30:00Z"), // 31 Oct 23:30 WAT → October
        pay(gone.id, "deposit", 10000, "2026-10-21T10:00:00Z"), pay(gone.id, "refund", 10000, "2026-11-03T10:00:00Z"),
      ],
    });
    const o = computeMonth(i, "2026-10"), n = computeMonth(i, "2026-11");
    expect(o.moneyReceived).toBe(15000 + 15000 + 10000);
    expect(o.moneyReceivedBreakdown).toEqual({ deposits: 40000, balances: 0, refunds: 0, payments: 3 });
    expect(n.moneyReceived).toBe(15000 - 10000);
    expect(n.moneyReceivedBreakdown).toEqual({ deposits: 0, balances: 15000, refunds: 10000, payments: 2 });
    // …and it is a different number from Collected (what each month's appointments have paid).
    expect(o.collected).toBe(30000);
    expect(n.collected).toBe(0);
    expect(computeAll(i).totals.moneyReceived).toBe(45000);
  });

  it("is kept in the closed snapshot and reported if it changes later", () => {
    const a = bk({ date: "2026-10-20" });
    const closed = snapshotOf(computeMonth(input({ bookings: [a] }), "2026-10"));
    const later = computeMonth(input({ bookings: [a], payments: [pay(a.id, "balance", 30000, "2026-10-29T10:00:00Z")] }), "2026-10");
    expect(changesSinceClose(closed, later).map(c => c.display)).toContain("Money received: ₦0 → ₦30,000");
  });
});

describe("dashboard 'report is ready' notice", () => {
  it("normally shows from the 1st to the 7th (closed on the 1st at 02:00 WAT)", async () => {
    const { reportNoticeVisible } = await import("./finance");
    const closedAt = "2026-12-01T01:00:00Z";
    expect(reportNoticeVisible("2026-11-30", closedAt)).toBe(false);
    expect(reportNoticeVisible("2026-12-01", closedAt)).toBe(true);
    expect(reportNoticeVisible("2026-12-07", closedAt)).toBe(true);
    expect(reportNoticeVisible("2026-12-08", closedAt)).toBe(false);
  });
  it("for a catch-up close (October on 9 Nov) shows for 7 days from that day", async () => {
    const { reportNoticeVisible } = await import("./finance");
    expect(reportNoticeVisible("2026-11-09", "2026-11-09T01:00:00Z")).toBe(true);
    expect(reportNoticeVisible("2026-11-15", "2026-11-09T01:00:00Z")).toBe(true);
    expect(reportNoticeVisible("2026-11-16", "2026-11-09T01:00:00Z")).toBe(false);
    expect(reportNoticeVisible("2026-11-09", null)).toBe(false);
  });
});
