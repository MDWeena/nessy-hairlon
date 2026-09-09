import { Calendar, Eye, TrendingUp, Users } from "lucide-react";
import { fakeOrders } from "../../constants/orders";
import { useTheme } from "../../context/ThemeContext";
import { StatusBadge } from "../ui/StatusBadge";

export function Dashboard() {
  const { t } = useTheme();

  const stats = [
    { label: "This week", value: "12", sub: "bookings", icon: Calendar, color: t.gold },
    { label: "Pending review", value: "2", sub: "need pricing", icon: Eye, color: "#F59E0B" },
    { label: "Revenue (week)", value: "₦185k", sub: "+22% vs last week", icon: TrendingUp, color: "#10B981" },
    { label: "Clients (month)", value: "34", sub: "8 new this month", icon: Users, color: "#6366F1" },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} className="hover-lift" style={{
            background: t.surface, borderRadius: 12, padding: 20,
            border: `1px solid ${t.border}`, cursor: "default",
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
        {fakeOrders.filter(o => o.date.includes("Sep 8")).map(o => (
          <div key={o.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderBottom: `1px solid ${t.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}10)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: t.gold,
              }}>{o.client[0]}</div>
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
