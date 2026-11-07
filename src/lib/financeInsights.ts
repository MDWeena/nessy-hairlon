import { formatNaira, type MonthFigures } from "./finance.js";

/**
 * "What to do next": short, plain-language insights generated from Nessy's own numbers for one
 * month. Deterministic rules only (no AI), each showing the figures behind it. A loss month leads
 * with what would have turned it into a profit; a profit month leads with what drove it. Wording
 * stays encouraging and practical.
 */
export type InsightTone = "good" | "tip" | "heads_up";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  figures: { label: string; value: string }[];
}

const MAX_INSIGHTS = 6;
/** A category whose products eat more than this share of its price is worth a price review. */
export const PRODUCT_SHARE_WARNING = 0.4;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Income per appointment minus that appointment's products, materials and share of transport. */
function contributionPerBooking(m: MonthFigures): number | null {
  if (m.appointments === 0) return null;
  return (m.earned - m.costs.products - m.costs.materials - m.costs.transport) / m.appointments;
}

function averagePrice(m: MonthFigures): number | null {
  return m.appointments > 0 ? m.earned / m.appointments : null;
}

function change(now: number, before: number): string {
  if (before === 0) return now === 0 ? "no change" : "up from nothing";
  const d = (now - before) / Math.abs(before);
  if (Math.abs(d) < 0.005) return "about the same";
  return `${d > 0 ? "up" : "down"} ${pct(Math.abs(d))}`;
}

export function leadInsight(m: MonthFigures, previous: MonthFigures | null): Insight | null {
  if (m.appointments === 0 && m.keptDeposits === 0) {
    return {
      id: "lead", tone: "tip", title: m.isCurrent ? "Your month is just getting started" : "A quiet month",
      body: m.isCurrent
        ? "No appointments have taken place yet this month. Each one you complete will show up here."
        : "No appointments took place this month, so its costs weren't covered. A few bookings would turn that around quickly.",
      figures: [{ label: "Costs", value: formatNaira(m.costs.total) }],
    };
  }
  const avg = averagePrice(m) ?? 0;
  if (m.profit < 0) {
    const gap = -m.profit;
    const perBooking = contributionPerBooking(m);
    const moreBookings = perBooking && perBooking > 0 ? Math.ceil(gap / perBooking) : null;
    const priceRise = m.appointments > 0 ? Math.ceil(gap / m.appointments / 100) * 100 : null;
    const ways = [
      moreBookings !== null ? `${plural(moreBookings, "more booking")} at your average price of ${formatNaira(avg)}` : null,
      priceRise !== null ? `an average price about ${formatNaira(priceRise)} higher` : null,
    ].filter(Boolean);
    return {
      id: "lead", tone: "tip",
      title: m.isCurrent ? `${formatNaira(gap)} to go to break even this month` : `${formatNaira(gap)} short of a profit`,
      body: ways.length
        ? `${m.isCurrent ? "To finish the month in profit you'd need" : "This month would have been in profit with"} ${ways.join(", or ")}. You're closer than it looks.`
        : "Costs came in above income this month. The tips below show where the quickest wins are.",
      figures: [
        { label: "Income", value: formatNaira(m.earned + m.keptDeposits) },
        { label: "Costs", value: formatNaira(m.costs.total) },
        ...(perBooking !== null ? [{ label: "Kept per booking (before salary)", value: formatNaira(perBooking) }] : []),
      ],
    };
  }
  // Profit: what drove it
  const top = [...m.byCategory].sort((a, b) => b.profit - a.profit)[0];
  const drivers: string[] = [];
  if (previous && previous.appointments > 0 && m.appointments > previous.appointments) drivers.push(`${m.appointments - previous.appointments} more appointments than last month`);
  if (previous && previous.appointments > 0 && avg > (averagePrice(previous) ?? 0)) drivers.push(`a higher average price (${formatNaira(avg)})`);
  if (top && m.earned > 0) drivers.push(`${top.category}, which brought in ${pct(top.revenue / m.earned)} of your income`);
  return {
    id: "lead", tone: "good", title: `${formatNaira(m.profit)} profit${m.isCurrent ? " so far" : ""}`,
    body: drivers.length ? `Nice work. What helped most: ${drivers.join("; ")}.` : "Nice work — your income covered all your costs.",
    figures: [
      { label: "Income", value: formatNaira(m.earned + m.keptDeposits) },
      { label: "Costs", value: formatNaira(m.costs.total) },
      ...(m.margin !== null ? [{ label: "Margin", value: pct(m.margin) }] : []),
    ],
  };
}

export function breakEvenInsight(m: MonthFigures): Insight | null {
  const perBooking = contributionPerBooking(m);
  const fixed = m.fixedCostsFullMonth;
  if (perBooking === null || fixed <= 0) return null;
  if (perBooking <= 0) {
    return {
      id: "break_even", tone: "heads_up", title: "Each booking isn't covering its own costs yet",
      body: "After products, materials and transport, the average booking left nothing towards salary and overheads. Reviewing prices on your busiest styles is the quickest fix.",
      figures: [{ label: "Kept per booking", value: formatNaira(perBooking) }, { label: "Fixed costs / month", value: formatNaira(fixed) }],
    };
  }
  const needed = Math.ceil(fixed / perBooking);
  const met = m.appointments >= needed;
  return {
    id: "break_even", tone: met ? "good" : "tip",
    title: `Break-even: about ${plural(needed, "booking")} a month`,
    body: met
      ? `You did ${m.appointments} — comfortably covering salary and fixed costs.`
      : `You did ${m.appointments}${m.isCurrent ? " so far" : ""}. ${plural(needed - m.appointments, "more booking")} ${m.isCurrent ? "this month covers" : "would have covered"} salary and fixed costs.`,
    figures: [
      { label: "Fixed costs / month", value: formatNaira(fixed) },
      { label: "Kept per booking (before fixed costs)", value: formatNaira(perBooking) },
      { label: "Bookings", value: String(m.appointments) },
    ],
  };
}

export function categoryInsights(m: MonthFigures): Insight[] {
  const out: Insight[] = [];
  const cats = m.byCategory.filter(c => c.bookings > 0);
  if (cats.length >= 2) {
    const best = cats[0], worst = cats[cats.length - 1];
    out.push({
      id: "categories", tone: "tip", title: `${best.category} earns you the most per booking`,
      body: `${best.category} leaves about ${formatNaira(best.avgProfit)} per booking after products and materials, versus ${formatNaira(worst.avgProfit)} for ${worst.category}. Featuring ${best.category} more could lift your month.`,
      figures: cats.map(c => ({ label: `${c.category} (${c.bookings})`, value: `${formatNaira(c.avgProfit)} / booking` })),
    });
  }
  const heavy = cats.filter(c => c.productShare > PRODUCT_SHARE_WARNING && c.revenue > 0);
  for (const c of heavy) {
    out.push({
      id: `product_share_${c.category}`, tone: "heads_up", title: `Products take ${pct(c.productShare)} of ${c.category} prices`,
      body: `That's more than ${pct(PRODUCT_SHARE_WARNING)} of what clients pay. It may be worth reviewing the ${c.category} price or the products used.`,
      figures: [{ label: "Average price", value: formatNaira(c.avgPrice) }, { label: "Products per booking", value: formatNaira(c.products / c.bookings) }],
    });
  }
  return out;
}

export function transportInsight(m: MonthFigures): Insight | null {
  if (m.workingDays === 0) return null;
  const single = m.costs.transportDays.filter(d => d.appointments === 1);
  if (single.length === 0) {
    return {
      id: "transport", tone: "good", title: "Transport used well",
      body: `Every working day had more than one appointment, so each fare was shared.`,
      figures: [{ label: "Transport", value: `${plural(m.workingDays, "day")} · ${formatNaira(m.costs.transport)}` }],
    };
  }
  const cost = single.reduce((s, d) => s + d.rate, 0);
  return {
    id: "transport", tone: "tip", title: `${plural(single.length, "day")} with just one appointment`,
    body: `Those days cost ${formatNaira(cost)} in transport for a single booking each. Offering clients slots on days you're already working would share that fare.`,
    figures: [{ label: "Single-booking days", value: String(single.length) }, { label: "Their transport", value: formatNaira(cost) }],
  };
}

export function salaryInsight(m: MonthFigures, previous: MonthFigures | null): Insight | null {
  if (m.costs.salary <= 0 || m.earned <= 0) return null;
  const share = m.costs.salary / m.earned;
  const prevShare = previous && previous.costs.salary > 0 && previous.earned > 0 ? previous.costs.salary / previous.earned : null;
  const trend = prevShare === null ? "" : share < prevShare ? ` That's down from ${pct(prevShare)} last month — moving the right way.` : share > prevShare ? ` Up from ${pct(prevShare)} last month.` : "";
  return {
    id: "salary", tone: share <= 0.3 ? "good" : "tip", title: `Salary is ${pct(share)} of income`,
    body: `${formatNaira(m.costs.salary)} of ${formatNaira(m.earned)} earned went to salary.${trend}${share > 0.3 ? " More bookings each month spreads this cost thinner." : ""}`,
    figures: [{ label: "Salary", value: formatNaira(m.costs.salary) }, { label: "Earned", value: formatNaira(m.earned) }],
  };
}

export function outstandingInsight(m: MonthFigures): Insight | null {
  if (m.outstanding <= 0) return null;
  return {
    id: "outstanding", tone: "tip", title: `${formatNaira(m.outstanding)} still to collect`,
    body: `${plural(m.unpaid.length, "client")} still owe${m.unpaid.length === 1 ? "s" : ""} a balance. A friendly reminder usually does it.`,
    figures: m.unpaid.map(u => ({ label: u.clientName, value: formatNaira(u.owed) })),
  };
}

export function monthOverMonthInsight(m: MonthFigures, previous: MonthFigures | null): Insight | null {
  if (!previous || (previous.appointments === 0 && previous.earned === 0)) return null;
  const avgNow = averagePrice(m), avgBefore = averagePrice(previous);
  return {
    id: "mom", tone: m.profit >= previous.profit ? "good" : "tip",
    title: `Compared with ${previous.label.split(" ")[0]}`,
    body: `Income ${change(m.earned, previous.earned)}, bookings ${change(m.appointments, previous.appointments)}${avgNow !== null && avgBefore !== null ? `, average price ${change(avgNow, avgBefore)}` : ""}.${m.isCurrent ? " (This month isn't over yet.)" : ""}`,
    figures: [
      { label: "Income", value: `${formatNaira(previous.earned)} → ${formatNaira(m.earned)}` },
      { label: "Bookings", value: `${previous.appointments} → ${m.appointments}` },
      { label: "Profit", value: `${formatNaira(previous.profit)} → ${formatNaira(m.profit)}` },
    ],
  };
}

export function dataGapInsight(m: MonthFigures): Insight | null {
  if (m.costs.productsMissing === 0) return null;
  return {
    id: "data_gaps", tone: "heads_up", title: `${plural(m.costs.productsMissing, "booking")} missing a product cost`,
    body: "Those count as ₦0 for now, so profit looks a little better than it really is. Adding them takes a minute.",
    figures: [{ label: "Missing product cost", value: String(m.costs.productsMissing) }],
  };
}

/** 3–6 insights for a month, the most useful first. */
export function generateInsights(m: MonthFigures, previous: MonthFigures | null): Insight[] {
  const candidates: (Insight | null)[] = [
    leadInsight(m, previous),
    dataGapInsight(m),
    breakEvenInsight(m),
    outstandingInsight(m),
    ...categoryInsights(m),
    transportInsight(m),
    salaryInsight(m, previous),
    monthOverMonthInsight(m, previous),
  ];
  const out = candidates.filter((i): i is Insight => i !== null).slice(0, MAX_INSIGHTS);
  // Quiet months produce few rule hits — top up to the minimum of 3 with always-true basics.
  const fillers: Insight[] = [
    {
      id: "fixed_costs", tone: "tip", title: `Fixed costs: ${formatNaira(m.fixedCostsFullMonth)} a month`,
      body: "Salary and regular monthly expenses are due whether or not it's busy, so they're the number every month's bookings need to beat.",
      figures: [{ label: "Fixed costs / month", value: formatNaira(m.fixedCostsFullMonth) }],
    },
    {
      id: "keep_records", tone: "tip", title: "Keep the records complete",
      body: "Adding a product cost when you price each booking, and logging expenses as they happen, keeps these numbers true to life.",
      figures: [{ label: "Appointments", value: String(m.appointments) }],
    },
  ];
  for (const f of fillers) if (out.length < 3 && !out.some(i => i.id === f.id)) out.push(f);
  return out;
}
