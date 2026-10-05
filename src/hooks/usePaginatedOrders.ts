import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { rowToOrder } from "./useBookings";
import type { BookingRow } from "./useBookings";
import { hourFromLabel } from "./useAvailability";
import type { Order, OrderFilter } from "../types";

export const PAGE_SIZE = 20;

export type OrdersStatusFilter = Exclude<OrderFilter, "this_week_confirmed">;
/** The subset of statuses actually shown as tabs (completed/cancelled bookings aren't a
 * visible tab on this page) — narrower than OrdersStatusFilter so "all" can't be passed
 * where a real status value is required (e.g. a `.eq("status", ...)` call). Exported so
 * Orders.tsx's FILTERS array (and its tabCounts[f] lookups) line up with this exactly. */
export type VisibleTab = "pending_review" | "quoted" | "deposit_paid" | "confirmed";

const STATUS_TABS: VisibleTab[] = ["pending_review", "quoted", "deposit_paid", "confirmed"];

export interface PaginatedOrdersParams {
  filter: OrdersStatusFilter;
  fromDate: string | null;
  toDate: string | null;
  search: string;
}

interface UsePaginatedOrdersResult {
  items: Order[];
  tabCounts: Record<"all" | VisibleTab, number>;
  hasMore: boolean;
  loadingInitial: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  /** Re-fetches exactly what's currently loaded, in place (after a mutating action) —
   * keeps scroll position/loaded count stable while reflecting the change. */
  refetchLoaded: () => void;
}

/** Strips characters that would break PostgREST's .or(...) filter-string syntax (comma separates
 * conditions, parens group them) — not a security concern (the query builder still parameterizes
 * the actual value), just keeps a stray "," or "(" in a search term from malforming the filter. */
function sanitizeForOr(q: string): string {
  return q.replace(/[,()]/g, " ").trim();
}

const FULL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Booking references ("BK-A3BF7FC4") match against `reference_code` (supabase/migrations/
 * 017_booking_reference_column.sql — a generated, stored text column: the id's first 8 hex
 * chars, uppercased). `id` itself is a uuid column and can't be ilike-matched directly —
 * Postgres has no ilike operator for uuid, and PostgREST's filter grammar has no way to cast
 * a column inline (confirmed live: both a plain `id.ilike` and `id::text.ilike` attempt either
 * error with "operator does not exist: uuid ~~* unknown" or fail to parse). A full pasted uuid
 * (e.g. from a `?booking=<uuid>` admin deep-link) is handled separately via an exact `id.eq`
 * match, which Postgres can do natively without any cast.
 */
function buildSearchOrClause(search: string): string | null {
  const q = sanitizeForOr(search);
  if (!q) return null;
  const parts = [
    `client_name.ilike.%${q}%`,
    `client_phone.ilike.%${q}%`,
    `client_email.ilike.%${q}%`,
    `reference_code.ilike.%${q}%`,
  ];
  const refFragment = q.replace(/^bk-?/i, "");
  if (refFragment && refFragment !== q) parts.push(`reference_code.ilike.%${refFragment}%`);
  if (FULL_UUID_RE.test(q)) parts.push(`id.eq.${q}`);
  return parts.join(",");
}

/** booking_time is free text ("9:00 AM"), not a sortable time column, so a plain .order() on it
 * would sort lexicographically ("10:00 AM" before "9:00 AM") — wrong. The database query below
 * only sorts by booking_date (a real date column, correct either way); this re-sorts same-date
 * rows within an already-small fetched batch using hourFromLabel for a correct same-day order. */
function sortBatch(rows: BookingRow[]): BookingRow[] {
  return [...rows].sort((a, b) => {
    if (a.booking_date !== b.booking_date) return b.booking_date.localeCompare(a.booking_date);
    return (hourFromLabel(b.booking_time) ?? 0) - (hourFromLabel(a.booking_time) ?? 0);
  });
}

/** Applies the date-range + search filters shared by both the main paginated fetch and the
 * head-only count queries below. Generic over whatever shape Supabase's fluent query builder
 * actually is at each call site (it differs slightly between a `.select("*", {count})` and a
 * `.select("id", {head: true})` call) rather than naming that type explicitly. */
function withSharedFilters<T extends { gte(col: string, v: string): T; lte(col: string, v: string): T; or(f: string): T }>(
  query: T,
  opts: { fromDate: string | null; toDate: string | null; search: string },
): T {
  let q = query;
  if (opts.fromDate) q = q.gte("booking_date", opts.fromDate);
  if (opts.toDate) q = q.lte("booking_date", opts.toDate);
  const orClause = buildSearchOrClause(opts.search);
  if (orClause) q = q.or(orClause);
  return q;
}

/**
 * Server-side filtered + paginated bookings for the admin Orders page's infinite-scroll list —
 * fetches via direct .range() queries against `bookings` (RLS already allows authenticated reads
 * via the existing "bookings_all_authenticated" policy; no new policy needed), instead of
 * useBookings()'s full-table fetch. Does NOT touch lookup_bookings — that's the public/anon
 * "track my booking" lookup, unrelated to this admin listing.
 */
export function usePaginatedOrders({ filter, fromDate, toDate, search }: PaginatedOrdersParams): UsePaginatedOrdersResult {
  const [rawRows, setRawRows] = useState<BookingRow[]>([]);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());
  const [totalCount, setTotalCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<"all" | VisibleTab, number>>({
    all: 0, pending_review: 0, quoted: 0, deposit_paid: 0, confirmed: 0,
  });
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Service names for the "service" column — bookings.service_ids is a uuid[], not a join;
  // fetched once (services change rarely) and applied at render time below, not refetched
  // alongside the paginated query.
  useEffect(() => {
    supabase.from("services").select("id, name").then(({ data }) => {
      if (data) setNameById(new Map(data.map(s => [s.id, s.name])));
    });
  }, []);

  const fetchRange = useCallback(async (offset: number, limit: number) => {
    let query = withSharedFilters(supabase.from("bookings").select("*", { count: "exact" }), { fromDate, toDate, search });
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error: fetchError, count } = await query
      .order("booking_date", { ascending: false })
      .range(offset, offset + limit - 1);
    if (fetchError) throw fetchError;
    return { rows: sortBatch(data ?? []), count: count ?? 0 };
  }, [filter, fromDate, toDate, search]);

  const fetchCounts = useCallback(async () => {
    const countQuery = (status?: VisibleTab) => {
      let q = withSharedFilters(supabase.from("bookings").select("id", { count: "exact", head: true }), { fromDate, toDate, search });
      if (status) q = q.eq("status", status);
      return q;
    };
    const [all, ...tabs] = await Promise.all([countQuery(), ...STATUS_TABS.map(s => countQuery(s))]);
    const next: Record<"all" | VisibleTab, number> = { all: all.count ?? 0, pending_review: 0, quoted: 0, deposit_paid: 0, confirmed: 0 };
    STATUS_TABS.forEach((s, i) => { next[s] = tabs[i].count ?? 0; });
    setTabCounts(next);
  }, [fromDate, toDate, search]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    let cancelled = false;
    setLoadingInitial(true);
    setError(null);
    (async () => {
      try {
        const { rows, count } = await fetchRange(0, PAGE_SIZE);
        if (cancelled) return;
        setRawRows(rows);
        setTotalCount(count);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load bookings");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    fetchCounts();
    return () => { cancelled = true; };
  }, [fetchRange, fetchCounts]);

  const loadMore = useCallback(() => {
    if (loadingMore || loadingInitial || rawRows.length >= totalCount) return;
    setLoadingMore(true);
    fetchRange(rawRows.length, PAGE_SIZE)
      .then(({ rows, count }) => {
        setRawRows(prev => [...prev, ...rows]);
        setTotalCount(count);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load more bookings"))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loadingInitial, rawRows.length, totalCount, fetchRange]);

  const refetchLoaded = useCallback(() => {
    const limit = Math.max(rawRows.length, PAGE_SIZE);
    fetchRange(0, limit)
      .then(({ rows, count }) => { setRawRows(rows); setTotalCount(count); })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to refresh bookings"));
    fetchCounts();
  }, [rawRows.length, fetchRange, fetchCounts]);

  return {
    items: rawRows.map(r => rowToOrder(r, nameById)),
    tabCounts,
    hasMore: rawRows.length < totalCount,
    loadingInitial, loadingMore, error, loadMore, refetchLoaded,
  };
}
