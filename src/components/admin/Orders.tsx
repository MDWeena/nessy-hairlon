import { useState } from "react";
import { fakeOrders } from "../../constants/orders";
import { statusColors } from "../../constants/statusColors";
import { useTheme } from "../../context/ThemeContext";
import type { OrderStatus } from "../../types";
import { StatusBadge } from "../ui/StatusBadge";

type OrderFilter = "all" | OrderStatus;

const FILTERS: OrderFilter[] = ["all", "pending_review", "quoted", "confirmed"];

export function Orders() {
  const { t } = useTheme();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const filtered = filter === "all" ? fakeOrders : fakeOrders.filter(o => o.status === filter);

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 16px", borderRadius: 20, border: `1px solid ${filter === f ? t.gold : t.border}`,
            background: filter === f ? t.goldBg : "transparent",
            color: filter === f ? t.gold : t.textSoft,
            fontWeight: filter === f ? 700 : 500, fontSize: 12, cursor: "pointer",
            transition: "all 0.2s",
          }}>{f === "all" ? "All" : statusColors[f]?.label}</button>
        ))}
      </div>

      <div style={{ background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        {filtered.map((o, i) => (
          <div key={o.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 20px",
            borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none",
            transition: "background 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}10)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, color: t.gold,
              }}>{o.client[0]}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{o.client}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{o.service}</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{o.date} at {o.time}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{o.price || "—"}</span>
              <StatusBadge status={o.status} />
              {o.status === "pending_review" && (
                <button style={{
                  background: t.gold, color: "#0A0A0A", border: "none",
                  padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                  cursor: "pointer",
                }}>Set Price</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
