import { Calendar, Eye, TrendingUp, Users } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useBookings } from "../../hooks/useBookings";
import { toISODateString } from "../../lib/date";
import type { OrderFilter } from "../../types";
import { StatusBadge } from "../ui/StatusBadge";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

interface DashboardProps {
  onNavigate: (page: string, filter?: OrderFilter) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { t } = useTheme();
  const { bookings, stats, loading, error } = useBookings();

  const today = toISODateString(new Date());
  const todaysBookings = bookings.filter(o => o.date === today);

  const statCards = [
    { label: "This week", value: String(stats.thisWeekCount), sub: "bookings", icon: Calendar, color: t.gold, onClick: () => onNavigate("orders") },
    { label: "Pending review", value: String(stats.pendingReviewCount), sub: "need pricing", icon: Eye, color: "#F59E0B", onClick: () => onNavigate("orders", "pending_review") },
    { label: "Revenue (week)", value: `₦${stats.revenueThisWeek.toLocaleString()}`, sub: "confirmed & completed", icon: TrendingUp, color: "#10B981", onClick: () => onNavigate("orders") },
    { label: "Clients (month)", value: String(stats.clientsThisMonthCount), sub: "unique clients", icon: Users, color: "#6366F1", onClick: () => onNavigate("orders") },
  ];

  if (loading) return <LoadingNotice label="Loading dashboard…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {statCards.map((s) => (
          <div key={s.label} className="hover-lift" role="button" tabIndex={0}
            onClick={s.onClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") s.onClick(); }}
            style={{
              background: t.surface, borderRadius: 12, padding: 20,
              border: `1px solid ${t.border}`, cursor: "pointer",
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

      {/* Today's schedule */}
      <div style={{ background: t.surface, borderRadius: 12, padding: 24, border: `1px solid ${t.border}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Today's schedule</h3>
        {todaysBookings.length === 0 ? (
          <p style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "12px 0" }}>
            No appointments scheduled for today.
          </p>
        ) : todaysBookings.map(o => (
          <div key={o.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderBottom: `1px solid ${t.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {o.customStyleUrl ? (
                <a href={o.customStyleUrl} target="_blank" rel="noopener noreferrer" title="Open full photo">
                  <img src={o.customStyleUrl} alt="Requested style" style={{
                    width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `1px solid ${t.gold}40`, cursor: "pointer",
                  }} />
                </a>
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}10)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: t.gold,
                }}>{o.client[0]}</div>
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{o.client}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{o.service}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: t.textSoft }}>{o.time}</span>
              <StatusBadge status={o.status} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
