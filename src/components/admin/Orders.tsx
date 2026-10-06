import { useCallback, useEffect, useRef, useState } from "react";
import { statusColors } from "../../constants/statusColors";
import { useBookings, rowToOrder } from "../../hooks/useBookings";
import { usePaginatedOrders } from "../../hooks/usePaginatedOrders";
import type { OrdersStatusFilter, VisibleTab } from "../../hooks/usePaginatedOrders";
import { useSettings } from "../../hooks/useSettings";
import { supabase } from "../../lib/supabase";
import { calculateBalanceAmount } from "../../lib/payments";
import { buildWhatsAppUrl } from "../../lib/whatsapp";
import { toISODateString, getWeekRange, getMonthRange, addDays } from "../../lib/date";
import { labelForUrl } from "../../lib/urlLabel";
import type { MaterialItem, Order, OrderFilter } from "../../types";
import { Plus, Minus, Trash2, CheckCircle2, Bell, MessageCircle, MailWarning, Search, X, Filter, ExternalLink } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";
import { MoneyInput } from "../ui/MoneyInput";

const FILTERS: ("all" | VisibleTab)[] = ["all", "pending_review", "quoted", "deposit_paid", "confirmed"];

const FILTERS_STORAGE_KEY = "nessy_admin_orders_filters";
const SELECT_CLASS = "py-1.5 px-2.5 rounded-md border border-border bg-bg-alt text-xs text-text outline-none";

interface DateRange {
  from: string | null;
  to: string | null;
}

interface StoredOrdersFilters {
  filter: OrderFilter;
  search: string;
  from: string | null;
  to: string | null;
  filtersOpen: boolean;
}

const QUICK_SELECTS: { label: string; range: () => DateRange }[] = [
  { label: "This Month", range: () => { const r = getMonthRange(new Date()); return { from: r.start, to: r.end }; } },
  { label: "Last Month", range: () => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const r = getMonthRange(d); return { from: r.start, to: r.end };
  } },
  { label: "This Year", range: () => {
    const y = new Date().getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  } },
  { label: "Last 7 Days", range: () => ({ from: toISODateString(addDays(new Date(), -6)), to: toISODateString(new Date()) }) },
  { label: "All Time", range: () => ({ from: null, to: null }) },
];

function loadStoredFilters(): StoredOrdersFilters | null {
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredOrdersFilters) : null;
  } catch {
    return null;
  }
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Summary shown next to the collapsed Filters toggle, e.g. "Oct 1 – Dec 31 · 'Sarah'". */
function buildFilterSummary(fromDate: string | null, toDate: string | null, search: string): string | null {
  const parts: string[] = [];
  if (fromDate && toDate) parts.push(`${formatShortDate(fromDate)} – ${formatShortDate(toDate)}`);
  else if (fromDate) parts.push(`From ${formatShortDate(fromDate)}`);
  else if (toDate) parts.push(`Until ${formatShortDate(toDate)}`);
  if (search.trim()) parts.push(`'${search.trim()}'`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const ITEM_INPUT = "py-1.5 px-2 rounded-md border border-border bg-bg-alt text-xs text-text outline-none";
// UX FIX (pre-launch audit): was w-6 h-6 (24x24px) — well under the ~44px touch-target
// guideline. Bumped to 36x36; not pushed all the way to 44px to stay within the row's
// tight mobile width budget alongside the type input, money field, and remove button.
const STEPPER_BTN = "w-9 h-9 shrink-0 rounded-md border border-border bg-bg-alt text-text-soft flex items-center justify-center cursor-pointer";

function buildBalanceWhatsAppMessage(
  o: Order,
  balanceDue: number,
  settings: { bank_name?: string; account_number?: string; account_name?: string },
): string {
  return `Hi ${o.client}, this is Nessy Hairlon. Your appointment on ${o.date} is complete but we haven't received the remaining balance of ₦${balanceDue.toLocaleString()}. Please transfer to ${settings.bank_name ?? ""} - ${settings.account_number ?? ""} - ${settings.account_name ?? ""}. Thank you!`;
}

function buildClientChatMessage(o: Order): string {
  return `Hi ${o.client}, regarding your ${o.service || "booking"} on ${o.date}…`;
}

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
}

/** Lets the field go empty while typing (so "13" -> delete -> "3" isn't needed to type "3"); clamps to >=1 on blur. */
function QuantityStepper({ value, onChange }: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className={STEPPER_BTN}><Minus size={12} /></button>
      <input
        type="text" inputMode="numeric" value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        className={`w-9 text-center ${ITEM_INPUT}`}
      />
      <button type="button" onClick={() => onChange(value + 1)} className={STEPPER_BTN}><Plus size={12} /></button>
    </div>
  );
}

interface OrdersProps {
  initialFilter?: OrderFilter;
  highlightBookingId?: string | null;
}

export function Orders({ initialFilter = "all", highlightBookingId }: OrdersProps) {
  const { settings } = useSettings();
  // bookings: only used below for submitQuote's by-id lookup of attachmentPreference — the
  // list itself is now fetched separately (server-side, paginated) via usePaginatedOrders.
  const {
    bookings, setQuotedPrice, updateBookingStatus, confirmDepositPayment, rejectDepositPayment,
    markBalancePaid, sendBalanceReminder,
  } = useBookings();
  // A deep-link from Dashboard (e.g. the "Pending review" stat card) always wins over
  // whatever filter a prior session left in sessionStorage — restoring stale filters should
  // never fight an explicit navigation intent.
  const storedFilters = initialFilter === "all" ? loadStoredFilters() : null;
  const [filter, setFilter] = useState<OrderFilter>(storedFilters?.filter ?? initialFilter);
  const [searchInput, setSearchInput] = useState(storedFilters?.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(storedFilters?.search ?? "");
  // No date filter active by default — shows all-time, not scoped to the current month.
  const [fromDate, setFromDate] = useState<string | null>(storedFilters?.from ?? null);
  const [toDate, setToDate] = useState<string | null>(storedFilters?.to ?? null);
  // Hidden by default; remembered across navigating away and back within the same session
  // (sessionStorage, same mechanism as the filter values below) — not required to survive an
  // actual page refresh, but doing so anyway via the same key is harmless.
  const [filtersOpen, setFiltersOpen] = useState(storedFilters?.filtersOpen ?? false);
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quoteValue, setQuoteValue] = useState(0);
  const [hairCostValue, setHairCostValue] = useState(0);
  const [attachItems, setAttachItems] = useState<MaterialItem[]>([]);
  const [accessItems, setAccessItems] = useState<MaterialItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [balanceActionId, setBalanceActionId] = useState<string | null>(null);
  const [reminderActionId, setReminderActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [highlightFading, setHighlightFading] = useState(false);

  // Debounce the search box so filtering doesn't re-run on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Persist filters across a page refresh (sessionStorage — this view isn't part of the
  // pathname-based page router, so there's no URL to put them in).
  useEffect(() => {
    const payload: StoredOrdersFilters = { filter, search: searchInput, from: fromDate, to: toDate, filtersOpen };
    try { sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  }, [filter, searchInput, fromDate, toDate, filtersOpen]);

  const clearFilters = () => {
    setFilter("all");
    setSearchInput("");
    setDebouncedSearch("");
    setFromDate(null);
    setToDate(null);
  };

  const applyQuickSelect = (range: DateRange) => {
    setFromDate(range.from);
    setToDate(range.to);
  };

  const isFilterActive = fromDate != null || toDate != null || searchInput.trim() !== "";
  const filterSummary = buildFilterSummary(fromDate, toDate, searchInput);

  // "this_week_confirmed" is a Dashboard-only drill-down (never a visible tab here, see
  // OrderFilter's own comment) — it's a small, bounded, two-status query unrelated to the
  // tab/date/search filter bar below, so it's fetched separately rather than folded into
  // usePaginatedOrders, which is built around a single active status + the visible filters.
  const [weekConfirmedItems, setWeekConfirmedItems] = useState<Order[] | null>(null);
  const fetchWeekConfirmed = useCallback(async () => {
    const { start, end } = getWeekRange(new Date());
    const [bookingsRes, servicesRes] = await Promise.all([
      supabase.from("bookings").select("*")
        .in("status", ["confirmed", "completed"])
        .gte("booking_date", start).lte("booking_date", end)
        .order("booking_date", { ascending: false }),
      supabase.from("services").select("id, name"),
    ]);
    const nameById = new Map((servicesRes.data ?? []).map(s => [s.id, s.name]));
    setWeekConfirmedItems((bookingsRes.data ?? []).map(r => rowToOrder(r, nameById)));
  }, []);
  useEffect(() => {
    if (filter !== "this_week_confirmed") { setWeekConfirmedItems(null); return; }
    fetchWeekConfirmed();
  }, [filter, fetchWeekConfirmed]);

  const isWeekConfirmedMode = filter === "this_week_confirmed";
  const {
    items: paginatedItems, tabCounts, hasMore, loadingInitial, loadingMore, error: ordersError, loadMore, refetchLoaded,
  } = usePaginatedOrders({
    filter: isWeekConfirmedMode ? "all" : (filter as OrdersStatusFilter),
    fromDate, toDate, search: debouncedSearch,
  });

  const items = isWeekConfirmedMode ? (weekConfirmedItems ?? []) : paginatedItems;
  const listLoading = isWeekConfirmedMode ? weekConfirmedItems === null : loadingInitial;

  // After any action that changes a booking's status/price/payment state, refresh whichever
  // list is currently showing — useBookings()'s own refetch (triggered by each action below)
  // only updates its own internal full-table state, not this page's separately server-fetched
  // list, so without this the visible row would show stale data until the next filter change.
  const refreshList = () => { if (isWeekConfirmedMode) fetchWeekConfirmed(); else refetchLoaded(); };

  // Infinite scroll — observes a sentinel after the list and loads the next batch once it's
  // within 200px of coming into view. Not armed in week-confirmed mode (small, unpaginated).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isWeekConfirmedMode) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isWeekConfirmedMode, loadMore]);

  // Scroll to and briefly highlight a deep-linked booking
  useEffect(() => {
    if (!highlightBookingId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightFading(true), 2500);
    return () => clearTimeout(timer);
  }, [highlightBookingId, listLoading]);

  const startQuote = (id: string) => {
    setActionError(null);
    setQuotingId(id);
    setQuoteValue(0);
    setHairCostValue(0);
    setAttachItems([]);
    setAccessItems([]);
  };

  const addItem = (list: MaterialItem[], setList: (items: MaterialItem[]) => void) => {
    setList([...list, { type: "", quantity: 1, unitCost: 0 }]);
  };

  const removeItem = (list: MaterialItem[], setList: (items: MaterialItem[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const updateItem = (list: MaterialItem[], setList: (items: MaterialItem[]) => void, idx: number, field: keyof MaterialItem, val: string) => {
    const updated = [...list];
    if (field === "type") updated[idx] = { ...updated[idx], type: val };
    else if (field === "quantity") updated[idx] = { ...updated[idx], quantity: Math.max(1, parseInt(val, 10) || 1) };
    else updated[idx] = { ...updated[idx], unitCost: Math.max(0, parseInt(val, 10) || 0) };
    setList(updated);
  };

  const sumItems = (items: MaterialItem[]) => items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const submitQuote = async (id: string) => {
    const order = bookings.find(o => o.id === id);
    const hasAttachPref = order?.attachmentPreference != null;

    if (hasAttachPref) {
      const hairCost = hairCostValue;
      if (!hairCost || hairCost <= 0) { setActionError("Enter a valid hair service cost"); return; }
      // Validate items have types filled in
      const badAttach = attachItems.some(i => !i.type.trim());
      const badAccess = accessItems.some(i => !i.type.trim());
      if (badAttach || badAccess) { setActionError("Please fill in all item names"); return; }

      const totalPrice = hairCost + sumItems(attachItems) + sumItems(accessItems);
      try {
        await setQuotedPrice(id, totalPrice, {
          hairServiceCost: hairCost,
          attachmentItems: attachItems,
          accessoryItems: accessItems,
        });
        setQuotingId(null);
        refreshList();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to set price");
      }
    } else {
      const price = quoteValue;
      if (!price || price <= 0) { setActionError("Enter a valid price"); return; }
      try {
        await setQuotedPrice(id, price);
        setQuotingId(null);
        refreshList();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to set price");
      }
    }
  };

  const confirmWithoutDeposit = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      await updateBookingStatus(id, "confirmed");
      refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to confirm booking");
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmPayment = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      await confirmDepositPayment(id);
      refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to confirm payment");
    } finally {
      setBusyId(null);
    }
  };

  const handlePaymentNotFound = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      await rejectDepositPayment(id);
      refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update booking");
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkBalancePaid = async (id: string) => {
    setActionError(null);
    setBalanceActionId(id);
    try {
      await markBalancePaid(id);
      refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark balance as paid");
    } finally {
      setBalanceActionId(null);
    }
  };

  const handleSendReminder = async (id: string) => {
    setActionError(null);
    setReminderActionId(id);
    try {
      await sendBalanceReminder(id);
      refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setReminderActionId(null);
    }
  };

  if (listLoading) return <LoadingNotice label="Loading bookings…" />;

  return (
    <>
      {!isWeekConfirmedMode && ordersError && <ErrorNotice message={ordersError} />}
      {actionError && <ErrorNotice message={actionError} />}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f} onClick={() => setFilter(f)}
            className={`py-[7px] px-4 rounded-full text-xs cursor-pointer border [transition:all_0.2s] ${
              filter === f ? "border-gold bg-gold-bg text-gold font-bold" : "border-border bg-transparent text-text-soft font-medium"
            }`}
          >
            {f === "all" ? "All" : statusColors[f]?.label}
            <span className="text-text-muted opacity-70 ml-1">({tabCounts[f] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Filter toggle — date range, search, quick-selects, and Clear filters all live inside
          the collapsible section below; hidden by default so the tabs + list are immediately
          visible, especially on mobile where the filter bar used to push the list offscreen. */}
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className={`flex items-center gap-1.5 rounded-md py-1.5 px-3 text-xs font-semibold cursor-pointer border [transition:all_0.2s] ${
            isFilterActive ? "border-gold bg-gold-bg text-gold" : "border-border bg-transparent text-text-soft"
          }`}
        >
          <Filter size={13} /> Filters{isFilterActive ? " (active)" : ""}
        </button>
        {isFilterActive && filterSummary && (
          <span className="text-xs text-text-muted">{filterSummary}</span>
        )}
      </div>

      <div
        className={`grid [transition:grid-template-rows_0.3s_ease] ${filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="date" value={fromDate ?? ""} onChange={(e) => setFromDate(e.target.value || null)}
                aria-label="From date" className={SELECT_CLASS}
              />
              <span className="text-text-muted text-xs">to</span>
              <input
                type="date" value={toDate ?? ""} onChange={(e) => setToDate(e.target.value || null)}
                aria-label="To date" className={SELECT_CLASS}
              />
            </div>
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, phone, email, or reference…"
                className="w-full py-1.5 pl-8 pr-8 rounded-md border border-border bg-bg-alt text-xs text-text outline-none box-border"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-text-muted flex items-center"
                ><X size={14} /></button>
              )}
            </div>
            <button
              onClick={clearFilters}
              className="shrink-0 bg-transparent border border-border rounded-md py-1.5 px-3 text-xs text-text-soft cursor-pointer whitespace-nowrap"
            >Clear filters</button>
          </div>

          <div className="flex gap-1.5 mb-6 flex-wrap">
            {QUICK_SELECTS.map(qs => (
              <button
                key={qs.label} onClick={() => applyQuickSelect(qs.range())}
                className="bg-transparent border border-border rounded-md py-1 px-2.5 text-[11px] text-text-soft cursor-pointer whitespace-nowrap hover:border-gold hover:text-gold"
              >{qs.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {!listLoading && items.length === 0 && (
          <p className="text-sm text-text-muted text-center py-10">No bookings match this filter.</p>
        )}
        {items.map((o, i) => {
          const isHighlighted = o.id === highlightBookingId;
          const showBalanceSection = o.status === "confirmed" || o.status === "completed";
          const balanceDue = showBalanceSection
            ? calculateBalanceAmount({
                quotedPrice: o.quotedPrice,
                attachmentPreference: o.attachmentPreference,
                attachmentItems: o.attachmentItems,
                accessoryItems: o.accessoryItems,
                hairServiceCost: o.hairServiceCost,
                depositConfirmedAt: o.depositConfirmedAt,
              }, settings.deposit_percentage ?? null)
            : null;
          const datePassed = o.date < toISODateString(new Date());
          return (
          <div
            key={o.id} ref={isHighlighted ? highlightRef : undefined}
            className={`py-4 px-5 [transition:background_0.8s] ${i < items.length - 1 ? "border-b border-border" : "border-b-0"} ${
              isHighlighted && !highlightFading ? "bg-[#C49A6C18]" : "bg-transparent"
            }`}
          >
          <div className="flex justify-between items-center flex-wrap gap-y-2.5">
            <div className="flex items-center gap-3.5 min-w-0">
              {o.customStyleUrl ? (
                <a href={o.customStyleUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Open full photo">
                  <img src={o.customStyleUrl} alt="Requested style" className="w-10 h-10 rounded-full object-cover border border-[#C49A6C40] cursor-pointer" />
                </a>
              ) : (
                <div className="w-10 h-10 rounded-full shrink-0 bg-[linear-gradient(135deg,#C49A6C30,#C49A6C10)] flex items-center justify-center text-[15px] font-bold text-gold">
                  {o.client[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{o.client}</div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-text-muted overflow-hidden text-ellipsis whitespace-nowrap">{o.service}</span>
                  {o.attachmentPreference === "nessy_buys" && (
                    <span className="text-[9px] font-bold text-gold bg-gold-bg py-px px-[7px] rounded-lg shrink-0 whitespace-nowrap">Nessy supplies</span>
                  )}
                  {o.attachmentPreference === "client_provides" && (
                    <span className="text-[9px] font-bold text-text-muted bg-bg-alt py-px px-[7px] rounded-lg shrink-0 whitespace-nowrap">Client supplies</span>
                  )}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">{o.date} at {o.time}</div>
                {o.customStyleDescription && (
                  <div className="text-[11px] text-text-soft mt-1 italic max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap">
                    "{o.customStyleDescription}"
                  </div>
                )}
                {o.styleReferenceUrls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {o.styleReferenceUrls.map(url => (
                      <a
                        key={url} href={url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-gold bg-gold-bg py-[3px] px-2 rounded-lg border border-[#C49A6C30] whitespace-nowrap"
                      >{labelForUrl(url)} <ExternalLink size={9} /></a>
                    ))}
                  </div>
                )}
                {o.clientNotes && (
                  <div className="text-[11px] text-text-soft mt-1.5 italic max-w-[320px] bg-bg-alt border border-border rounded-md py-1.5 px-2">
                    "{o.clientNotes}"
                  </div>
                )}
                {!o.clientEmail && (
                  <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-[#F59E0B] bg-[#F59E0B15] py-0.5 px-[7px] rounded-[10px]">
                    <MailWarning size={10} /> No email
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {quotingId === o.id ? (
                o.attachmentPreference ? (
                  <div className="text-xs text-text-soft">Quoting below…</div>
                ) : (
                <>
                  <MoneyInput
                    value={quoteValue} onChange={setQuoteValue}
                    placeholder="amount" autoFocus
                    style={{ width: 110, fontSize: 12 }}
                  />
                  <button
                    onClick={() => submitQuote(o.id)}
                    className="bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-xs font-bold cursor-pointer"
                  >Save</button>
                  <button
                    onClick={() => setQuotingId(null)}
                    className="bg-transparent border border-border rounded-md py-1.5 px-3 text-xs text-text-soft cursor-pointer"
                  >Cancel</button>
                </>
                )
              ) : (
                <>
                  <span className="text-sm font-bold">{o.price || "—"}</span>
                  <StatusBadge status={o.status} />
                  <a
                    href={buildWhatsAppUrl(o.clientPhone, buildClientChatMessage(o))}
                    target="_blank" rel="noopener noreferrer" title={`WhatsApp ${o.client}`}
                    className="text-[#22c55e] p-1 rounded-md flex items-center justify-center shrink-0"
                  ><MessageCircle size={16} /></a>
                  {o.status === "pending_review" && (
                    <button
                      onClick={() => startQuote(o.id)}
                      className="bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-xs font-bold cursor-pointer"
                    >Set Price</button>
                  )}
                </>
              )}
            </div>
          </div>

          {o.status === "quoted" && quotingId !== o.id && (
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border flex-wrap gap-2">
              <span className="text-xs text-text-muted">Waiting for client deposit</span>
              <button
                onClick={() => confirmWithoutDeposit(o.id)} disabled={busyId === o.id}
                className={`bg-transparent border border-border rounded-md py-1.5 px-3 text-[11px] text-text-soft flex items-center gap-1.5 ${busyId === o.id ? "cursor-wait" : "cursor-pointer"}`}
              >{busyId === o.id && <GoldSpinner size={12} />} {busyId === o.id ? "Confirming…" : "Confirm without deposit"}</button>
            </div>
          )}

          {o.status === "deposit_paid" && (
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border gap-3 flex-wrap">
              {o.paymentProofUrl ? (
                <a href={o.paymentProofUrl} target="_blank" rel="noopener noreferrer" title="Open payment proof" className="shrink-0">
                  <img src={o.paymentProofUrl} alt="Payment proof" className="w-9 h-9 rounded-md object-cover border border-[#C49A6C40] cursor-pointer" />
                </a>
              ) : (
                <span className="text-xs text-text-muted">No payment screenshot attached</span>
              )}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handlePaymentNotFound(o.id)} disabled={busyId === o.id}
                  className={`bg-transparent border border-[#EF444440] rounded-md py-1.5 px-3 text-[11px] text-[#EF4444] ${busyId === o.id ? "cursor-wait" : "cursor-pointer"}`}
                >Payment Not Found</button>
                <button
                  onClick={() => handleConfirmPayment(o.id)} disabled={busyId === o.id}
                  className={`bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 ${busyId === o.id ? "cursor-wait" : "cursor-pointer"}`}
                >{busyId === o.id && <GoldSpinner size={12} color="#0A0A0A" />} {busyId === o.id ? "Confirming…" : "Confirm Payment"}</button>
              </div>
            </div>
          )}

          {showBalanceSection && (
            <div className="mt-3 pt-3 border-t border-border">
              {o.balancePaidAt ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#10B981]">
                  <CheckCircle2 size={14} /> Fully Paid
                </div>
              ) : (
                <div className="flex justify-between items-center flex-wrap gap-2.5">
                  <span className="text-xs text-text-muted">
                    Balance due: <strong className="text-text">{balanceDue != null ? `₦${balanceDue.toLocaleString()}` : "—"}</strong>
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {datePassed && balanceDue != null && balanceDue > 0 && (
                      o.clientEmail ? (
                        <button
                          onClick={() => handleSendReminder(o.id)} disabled={reminderActionId === o.id}
                          className={`bg-gold-bg border border-[#C49A6C30] rounded-md py-1.5 px-3 text-[11px] font-semibold text-gold flex items-center gap-1.5 ${reminderActionId === o.id ? "cursor-wait" : "cursor-pointer"}`}
                        >
                          {reminderActionId === o.id ? <GoldSpinner size={12} /> : <Bell size={12} />}
                          {reminderActionId === o.id ? "Sending…" : o.balanceReminderSentAt ? "Resend Reminder" : "Send Balance Reminder"}
                        </button>
                      ) : (
                        <a
                          href={buildWhatsAppUrl(o.clientPhone, buildBalanceWhatsAppMessage(o, balanceDue, settings))}
                          target="_blank" rel="noopener noreferrer"
                          className="bg-[#22c55e] text-white border-none rounded-md py-1.5 px-3 text-[11px] font-semibold no-underline flex items-center gap-1.5"
                        ><MessageCircle size={12} /> WhatsApp Reminder</a>
                      )
                    )}
                    <button
                      onClick={() => handleMarkBalancePaid(o.id)} disabled={balanceActionId === o.id}
                      className={`bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 ${balanceActionId === o.id ? "cursor-wait" : "cursor-pointer"}`}
                    >
                      {balanceActionId === o.id && <GoldSpinner size={12} color="#0A0A0A" />}
                      {balanceActionId === o.id ? "Marking…" : "Mark Balance Paid"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {quotingId === o.id && o.attachmentPreference && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="grid gap-3">
                <div>
                  <label className="text-[11px] text-text-muted font-semibold mb-1 block">Hair Service Cost</label>
                  <MoneyInput
                    value={hairCostValue} onChange={setHairCostValue}
                    placeholder="hair service" autoFocus
                    style={{ width: "100%", fontSize: 13 }}
                  />
                </div>

                {/* Attachment items */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] text-text-muted font-semibold">Attachments</label>
                    <button onClick={() => addItem(attachItems, setAttachItems)} className="bg-transparent border-none text-gold text-[11px] font-semibold cursor-pointer flex items-center gap-0.5 p-0">
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {attachItems.map((item, idx) => (
                    <div key={idx} className="flex flex-wrap gap-1.5 mb-1.5 items-center">
                      <input
                        value={item.type} onChange={(e) => updateItem(attachItems, setAttachItems, idx, "type", e.target.value)}
                        placeholder="Type" className={`w-full sm:w-auto sm:flex-[2] ${ITEM_INPUT}`}
                      />
                      <QuantityStepper value={item.quantity} onChange={(next) => updateItem(attachItems, setAttachItems, idx, "quantity", String(next))} />
                      <MoneyInput value={item.unitCost} onChange={(v) => updateItem(attachItems, setAttachItems, idx, "unitCost", String(v))} placeholder="each" style={{ width: 80, fontSize: 12 }} />
                      <button onClick={() => removeItem(attachItems, setAttachItems, idx)} className="bg-transparent border-none text-[#EF4444] cursor-pointer p-0.5 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {attachItems.length > 0 && <div className="text-[11px] text-text-soft text-right">Subtotal: ₦{sumItems(attachItems).toLocaleString()}</div>}
                </div>

                {/* Accessory items */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] text-text-muted font-semibold">Accessories</label>
                    <button onClick={() => addItem(accessItems, setAccessItems)} className="bg-transparent border-none text-gold text-[11px] font-semibold cursor-pointer flex items-center gap-0.5 p-0">
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {accessItems.map((item, idx) => (
                    <div key={idx} className="flex flex-wrap gap-1.5 mb-1.5 items-center">
                      <input
                        value={item.type} onChange={(e) => updateItem(accessItems, setAccessItems, idx, "type", e.target.value)}
                        placeholder="Type" className={`w-full sm:w-auto sm:flex-[2] ${ITEM_INPUT}`}
                      />
                      <QuantityStepper value={item.quantity} onChange={(next) => updateItem(accessItems, setAccessItems, idx, "quantity", String(next))} />
                      <MoneyInput value={item.unitCost} onChange={(v) => updateItem(accessItems, setAccessItems, idx, "unitCost", String(v))} placeholder="each" style={{ width: 80, fontSize: 12 }} />
                      <button onClick={() => removeItem(accessItems, setAccessItems, idx)} className="bg-transparent border-none text-[#EF4444] cursor-pointer p-0.5 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {accessItems.length > 0 && <div className="text-[11px] text-text-soft text-right">Subtotal: ₦{sumItems(accessItems).toLocaleString()}</div>}
                </div>

                {/* Total and actions */}
                <div className="border-t border-border pt-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5">
                  <div className="text-[13px] font-bold">
                    Total: ₦{(hairCostValue + sumItems(attachItems) + sumItems(accessItems)).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setQuotingId(null)} className="flex-1 sm:flex-initial bg-transparent border border-border rounded-md py-1.5 px-3 text-xs text-text-soft cursor-pointer">Cancel</button>
                    <button onClick={() => submitQuote(o.id)} className="flex-1 sm:flex-initial bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-xs font-bold cursor-pointer">Save Quote</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
          );
        })}
        {/* Infinite scroll sentinel — loadMore() fires via IntersectionObserver when this
            scrolls near into view. Not shown in week-confirmed mode (small, unpaginated). */}
        {!isWeekConfirmedMode && items.length > 0 && (
          <div ref={sentinelRef} className="flex justify-center items-center py-4 border-t border-border">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <GoldSpinner size={14} /> Loading more…
              </div>
            ) : !hasMore ? (
              <span className="text-xs text-text-muted opacity-60">All bookings loaded</span>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
