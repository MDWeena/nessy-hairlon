/** Formats a Date as a local (not UTC) yyyy-mm-dd string, matching Postgres `date` columns. */
export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Monday–Sunday range (inclusive, as ISO date strings) containing the given date. */
export function getWeekRange(date: Date): { start: string; end: string } {
  const day = date.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toISODateString(monday), end: toISODateString(sunday) };
}

/** First–last day (inclusive, as ISO date strings) of the calendar month containing the given date. */
export function getMonthRange(date: Date): { start: string; end: string } {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toISODateString(firstDay), end: toISODateString(lastDay) };
}
