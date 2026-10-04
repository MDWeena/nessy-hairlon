import { Calendar, Eye, TrendingUp, Users, Clock, AlertCircle, CheckCircle, PieChart } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useBookings } from "../../hooks/useBookings";
import { toISODateString } from "../../lib/date";
import type { Order, OrderFilter } from "../../types";
import { StatusBadge } from "../ui/StatusBadge";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

interface DashboardProps {
  onNavigate: (page: string, filter?: OrderFilter) => void;
}

/** Returns bookings for today through the next `days` calendar days (inclusive). */
function getUpcomingBookings(bookings: Order[], days: number): Order[] {
  const today = new Date();
  const todayStr = toISODateString(today);
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);
  const futureStr = toISODateString(futureDate);
  return bookings.filter(
    o => o.date >= todayStr && o.date <= futureStr && (o.status === "confirmed" || o.status === "completed")
  );
}

function BookingAvatar({ client, customStyleUrl, linked }: { client: string; customStyleUrl: string | null; linked?: boolean }) {
  if (customStyleUrl) {
    const img = (
      <img
        src={customStyleUrl} alt={linked ? "Requested style" : ""}
        className={`w-9 h-9 rounded-full object-cover border border-[#C49A6C40] shrink-0 ${linked ? "cursor-pointer" : ""}`}
      />
    );
    return linked ? (
      <a href={customStyleUrl} target="_blank" rel="noopener noreferrer" title="Open full photo" className="shrink-0">{img}</a>
    ) : img;
  }
  return (
    <div className="w-9 h-9 rounded-full shrink-0 bg-[linear-gradient(135deg,#C49A6C30,#C49A6C10)] flex items-center justify-center text-sm font-bold text-gold">
      {client[0]}
    </div>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { t } = useTheme();
  const { bookings, stats, revenueBreakdown, loading, error } = useBookings();

  const today = toISODateString(new Date());
  const todaysBookings = bookings.filter(o => o.date === today && (o.status === "confirmed" || o.status === "completed"));
  const needsAttention = bookings.filter(o => o.status === "pending_review" || o.status === "deposit_paid");
  const upcomingConfirmed = getUpcomingBookings(bookings, 7).filter(o => o.date > today);

  const statCards = [
    { label: "This week", value: String(stats.thisWeekCount), sub: "bookings", icon: Calendar, color: t.gold, onClick: () => onNavigate("orders") },
    { label: "Pending review", value: String(stats.pendingReviewCount), sub: "need attention", icon: Eye, color: "#F59E0B", onClick: () => onNavigate("orders", "pending_review") },
    {
      label: "Revenue (week)", value: `₦${stats.revenueThisWeek.toLocaleString()}`,
      sub: `Deposits ₦${stats.depositsThisWeek.toLocaleString()} · Balance ₦${stats.balanceCollectedThisWeek.toLocaleString()}`,
      icon: TrendingUp, color: "#10B981", onClick: () => onNavigate("orders", "this_week_confirmed"),
    },
    { label: "Clients (month)", value: String(stats.clientsThisMonthCount), sub: "unique clients", icon: Users, color: "#6366F1" },
  ];

  if (loading) return <LoadingNotice label="Loading dashboard…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}

      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-7">
        {statCards.map((s) => (
          <div
            key={s.label} role={s.onClick ? "button" : undefined} tabIndex={s.onClick ? 0 : undefined}
            onClick={s.onClick}
            onKeyDown={s.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") s.onClick!(); } : undefined}
            className={`bg-surface rounded-xl p-5 border border-border ${s.onClick ? "hover-lift cursor-pointer" : "cursor-default"}`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-text-muted">{s.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <s.icon size={16} color={s.color} />
              </div>
            </div>
            <div className="text-[28px] font-bold leading-none">{s.value}</div>
            <div className="text-xs text-text-muted mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue breakdown — all-time audit view, independent of the weekly stat card above */}
      <div className="bg-surface rounded-xl p-6 border border-border mb-5">
        <div className="flex items-center gap-2 mb-4">
          <PieChart size={18} color={t.gold} />
          <h3 className="text-base font-bold m-0">Revenue Breakdown</h3>
          <span className="text-[11px] text-text-muted ml-auto">All-time · received payments only</span>
        </div>

        {/* Primary: Payments Received */}
        <div className="text-[10px] font-bold text-text-muted tracking-[0.5px] uppercase mb-2.5">
          Payments Received
        </div>
        <div className="grid gap-2.5">
          {[
            { label: "Deposits received", value: revenueBreakdown.depositsReceived, color: t.gold },
            { label: "Balance received", value: revenueBreakdown.balanceReceived, color: "#10B981" },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-[13px] text-text-soft flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                {row.label}
              </span>
              <span className="text-[13px] font-semibold">₦{row.value.toLocaleString()}</span>
            </div>
          ))}
          <div className="flex justify-between items-center border-t border-border pt-2.5 mt-0.5">
            <span className="text-[13px] font-bold">Total received</span>
            <span className="text-sm font-bold text-gold">₦{revenueBreakdown.totalReceived.toLocaleString()}</span>
          </div>
        </div>

        {/* Secondary: Material Costs (Nessy-supplied) — only when relevant */}
        {(revenueBreakdown.attachmentMaterialCosts > 0 || revenueBreakdown.accessoryMaterialCosts > 0) && (
          <div className="mt-5 pt-4 border-t border-dashed border-border">
            <div className="text-[10px] font-bold text-text-muted tracking-[0.5px] uppercase mb-2.5">
              Material costs (Nessy-supplied)
            </div>
            <div className="grid gap-2.5">
              {[
                { label: "Attachments (wigs, extensions)", value: revenueBreakdown.attachmentMaterialCosts, color: "#6366F1" },
                { label: "Accessories (clips, pins)", value: revenueBreakdown.accessoryMaterialCosts, color: "#F59E0B" },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-[13px] text-text-soft flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="text-[13px] font-semibold">₦{row.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Needs Attention section */}
      {needsAttention.length > 0 && (
        <div className="bg-surface rounded-xl p-6 border border-border mb-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} color="#F59E0B" />
            <h3 className="text-base font-bold m-0">Needs Your Attention</h3>
            <span className="text-xs text-text-muted ml-auto">
              {needsAttention.length} booking{needsAttention.length !== 1 ? "s" : ""}
            </span>
          </div>
          {needsAttention.slice(0, 5).map((o, i) => (
            <div
              key={o.id} onClick={() => onNavigate("orders", o.status === "pending_review" ? "pending_review" : "deposit_paid")}
              className={`hover-lift flex justify-between items-center py-3 px-3.5 rounded-[10px] cursor-pointer flex-wrap gap-y-2 [transition:background_0.15s] ${
                i % 2 === 0 ? "bg-[#C49A6C08]" : "bg-transparent"
              }`}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate("orders", o.status === "pending_review" ? "pending_review" : "deposit_paid"); }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <BookingAvatar client={o.client} customStyleUrl={o.customStyleUrl} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{o.client}</div>
                  <div className="text-xs text-text-muted">{o.date} at {o.time}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {o.price && <span className="text-[13px] font-semibold">{o.price}</span>}
                <StatusBadge status={o.status} />
                <span className="text-lg text-text-muted">›</span>
              </div>
            </div>
          ))}
          {needsAttention.length > 5 && (
            <button
              onClick={() => onNavigate("orders", "pending_review")}
              className="block w-full mt-3 py-2 text-xs text-gold bg-transparent border-none cursor-pointer font-semibold"
            >View all {needsAttention.length} items →</button>
          )}
        </div>
      )}

      {/* Today's schedule */}
      <div className="bg-surface rounded-xl p-6 border border-border mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} color={t.gold} />
          <h3 className="text-base font-bold m-0">Today's Schedule</h3>
          {todaysBookings.length > 0 && (
            <span className="text-[11px] font-bold py-0.5 px-2 rounded-[10px] bg-[#C49A6C20] text-gold ml-1.5">{todaysBookings.length}</span>
          )}
        </div>
        {todaysBookings.length === 0 ? (
          <p className="text-[13px] text-text-muted text-center py-4">
            No confirmed appointments for today.
          </p>
        ) : todaysBookings.map((o, i) => (
          <div
            key={o.id}
            className={`flex justify-between items-center py-3.5 flex-wrap gap-y-2 ${i < todaysBookings.length - 1 ? "border-b border-border" : "border-b-0"}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <BookingAvatar client={o.client} customStyleUrl={o.customStyleUrl} linked />
              <div className="min-w-0">
                <div className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{o.client}</div>
                <div className="text-xs text-text-muted overflow-hidden text-ellipsis whitespace-nowrap">{o.service}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[13px] font-semibold text-text-soft">{o.time}</span>
              {o.price && <span className="text-[13px] font-bold">{o.price}</span>}
              <StatusBadge status={o.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming this week */}
      <div className="bg-surface rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle size={18} color="#10B981" />
          <h3 className="text-base font-bold m-0">Upcoming This Week</h3>
          {upcomingConfirmed.length > 0 && (
            <span className="text-[11px] font-bold py-0.5 px-2 rounded-[10px] bg-[#10B98120] text-[#10B981] ml-1.5">{upcomingConfirmed.length}</span>
          )}
        </div>
        {upcomingConfirmed.length === 0 ? (
          <p className="text-[13px] text-text-muted text-center py-4">
            No upcoming confirmed appointments this week.
          </p>
        ) : upcomingConfirmed.map((o, i) => (
          <div
            key={o.id}
            className={`flex justify-between items-center py-3.5 flex-wrap gap-y-2 ${i < upcomingConfirmed.length - 1 ? "border-b border-border" : "border-b-0"}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <BookingAvatar client={o.client} customStyleUrl={o.customStyleUrl} linked />
              <div className="min-w-0">
                <div className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{o.client}</div>
                <div className="text-xs text-text-muted">{o.date} · {o.service}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[13px] font-semibold text-text-soft">{o.time}</span>
              {o.price && <span className="text-[13px] font-bold">{o.price}</span>}
              <StatusBadge status={o.status} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
