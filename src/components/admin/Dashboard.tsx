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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {statCards.map((s) => (
          <div key={s.label} className={s.onClick ? "hover-lift" : undefined} role={s.onClick ? "button" : undefined} tabIndex={s.onClick ? 0 : undefined}
            onClick={s.onClick}
            onKeyDown={s.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") s.onClick!(); } : undefined}
            style={{
              background: t.surface, borderRadius: 12, padding: 20,
              border: `1px solid ${t.border}`, cursor: s.onClick ? "pointer" : "default",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>{s.label}</span>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: `${s.color}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><s.icon size={16} color={s.color} /></div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue breakdown — all-time audit view, independent of the weekly stat card above */}
      <div style={{ background: t.surface, borderRadius: 12, padding: 24, border: `1px solid ${t.border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <PieChart size={18} color={t.gold} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Revenue Breakdown</h3>
          <span style={{ fontSize: 11, color: t.textMuted, marginLeft: "auto" }}>All-time · received payments only</span>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { label: "Styling (labour)", value: revenueBreakdown.hairServiceRevenue, color: t.gold },
            { label: "Attachments (wigs, extensions)", value: revenueBreakdown.attachmentRevenue, color: "#6366F1" },
            { label: "Accessories (clips, pins)", value: revenueBreakdown.accessoryRevenue, color: "#F59E0B" },
            { label: "Client-supplied bookings", value: revenueBreakdown.standardRevenue, color: "#10B981" },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: t.textSoft, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                {row.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>₦{row.value.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${t.border}`, paddingTop: 10, marginTop: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.gold }}>
              ₦{(
                revenueBreakdown.hairServiceRevenue + revenueBreakdown.attachmentRevenue +
                revenueBreakdown.accessoryRevenue + revenueBreakdown.standardRevenue
              ).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Needs Attention section */}
      {needsAttention.length > 0 && (
        <div style={{ background: t.surface, borderRadius: 12, padding: 24, border: `1px solid ${t.border}`, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <AlertCircle size={18} color="#F59E0B" />
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Needs Your Attention</h3>
            <span style={{ fontSize: 12, color: t.textMuted, marginLeft: "auto" }}>
              {needsAttention.length} booking{needsAttention.length !== 1 ? "s" : ""}
            </span>
          </div>
          {needsAttention.slice(0, 5).map((o, i) => (
            <div key={o.id} onClick={() => onNavigate("orders", o.status === "pending_review" ? "pending_review" : "deposit_paid")}
              className="hover-lift" role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate("orders", o.status === "pending_review" ? "pending_review" : "deposit_paid"); }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", borderRadius: 10,
                background: i % 2 === 0 ? `${t.gold}08` : "transparent",
                cursor: "pointer", flexWrap: "wrap", rowGap: 8,
                transition: "background 0.15s",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                {o.customStyleUrl ? (
                  <img src={o.customStyleUrl} alt="" style={{
                    width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `1px solid ${t.gold}40`, flexShrink: 0,
                  }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}10)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: t.gold,
                  }}>{o.client[0]}</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.client}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{o.date} at {o.time}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {o.price && <span style={{ fontSize: 13, fontWeight: 600 }}>{o.price}</span>}
                <StatusBadge status={o.status} />
                <span style={{ fontSize: 18, color: t.textMuted }}>›</span>
              </div>
            </div>
          ))}
          {needsAttention.length > 5 && (
            <button onClick={() => onNavigate("orders", "pending_review")} style={{
              display: "block", width: "100%", marginTop: 12, padding: "8px 0", fontSize: 12,
              color: t.gold, background: "none", border: "none", cursor: "pointer", fontWeight: 600,
            }}>View all {needsAttention.length} items →</button>
          )}
        </div>
      )}

      {/* Today's schedule */}
      <div style={{ background: t.surface, borderRadius: 12, padding: 24, border: `1px solid ${t.border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Clock size={18} color={t.gold} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Today's Schedule</h3>
          {todaysBookings.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
              background: `${t.gold}20`, color: t.gold, marginLeft: 6,
            }}>{todaysBookings.length}</span>
          )}
        </div>
        {todaysBookings.length === 0 ? (
          <p style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "16px 0" }}>
            No confirmed appointments for today.
          </p>
        ) : todaysBookings.map((o, i) => (
          <div key={o.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderBottom: i < todaysBookings.length - 1 ? `1px solid ${t.border}` : "none",
            flexWrap: "wrap", rowGap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {o.customStyleUrl ? (
                <a href={o.customStyleUrl} target="_blank" rel="noopener noreferrer" title="Open full photo" style={{ flexShrink: 0 }}>
                  <img src={o.customStyleUrl} alt="Requested style" style={{
                    width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `1px solid ${t.gold}40`, cursor: "pointer",
                  }} />
                </a>
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}10)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: t.gold,
                }}>{o.client[0]}</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.client}</div>
                <div style={{ fontSize: 12, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.service}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.textSoft }}>{o.time}</span>
              {o.price && <span style={{ fontSize: 13, fontWeight: 700 }}>{o.price}</span>}
              <StatusBadge status={o.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming this week */}
      <div style={{ background: t.surface, borderRadius: 12, padding: 24, border: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <CheckCircle size={18} color="#10B981" />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Upcoming This Week</h3>
          {upcomingConfirmed.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
              background: "#10B98120", color: "#10B981", marginLeft: 6,
            }}>{upcomingConfirmed.length}</span>
          )}
        </div>
        {upcomingConfirmed.length === 0 ? (
          <p style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "16px 0" }}>
            No upcoming confirmed appointments this week.
          </p>
        ) : upcomingConfirmed.map((o, i) => (
          <div key={o.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderBottom: i < upcomingConfirmed.length - 1 ? `1px solid ${t.border}` : "none",
            flexWrap: "wrap", rowGap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {o.customStyleUrl ? (
                <a href={o.customStyleUrl} target="_blank" rel="noopener noreferrer" title="Open full photo" style={{ flexShrink: 0 }}>
                  <img src={o.customStyleUrl} alt="Requested style" style={{
                    width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `1px solid ${t.gold}40`, cursor: "pointer",
                  }} />
                </a>
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}10)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: t.gold,
                }}>{o.client[0]}</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.client}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{o.date} · {o.service}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.textSoft }}>{o.time}</span>
              {o.price && <span style={{ fontSize: 13, fontWeight: 700 }}>{o.price}</span>}
              <StatusBadge status={o.status} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
