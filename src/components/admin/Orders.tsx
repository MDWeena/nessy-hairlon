import { useState } from "react";
import { statusColors } from "../../constants/statusColors";
import { useTheme } from "../../context/ThemeContext";
import { useBookings } from "../../hooks/useBookings";
import type { OrderStatus } from "../../types";
import { StatusBadge } from "../ui/StatusBadge";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

type OrderFilter = "all" | OrderStatus;

const FILTERS: OrderFilter[] = ["all", "pending_review", "quoted", "confirmed"];

export function Orders() {
  const { t } = useTheme();
  const { bookings, loading, error, setQuotedPrice } = useBookings();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quoteValue, setQuoteValue] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const filtered = filter === "all" ? bookings : bookings.filter(o => o.status === filter);

  const startQuote = (id: string) => {
    setActionError(null);
    setQuotingId(id);
    setQuoteValue("");
  };

  const submitQuote = async (id: string) => {
    const price = parseInt(quoteValue, 10);
    if (!price || price <= 0) { setActionError("Enter a valid price"); return; }
    try {
      await setQuotedPrice(id, price);
      setQuotingId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to set price");
    }
  };

  if (loading) return <LoadingNotice label="Loading bookings…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}
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
              {quotingId === o.id ? (
                <>
                  <input
                    type="number" value={quoteValue} onChange={(e) => setQuoteValue(e.target.value)}
                    placeholder="₦ amount" autoFocus
                    style={{
                      width: 110, padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.border}`,
                      background: t.bgAlt, fontSize: 12, color: t.text, outline: "none",
                    }}
                  />
                  <button onClick={() => submitQuote(o.id)} style={{
                    background: t.gold, color: "#0A0A0A", border: "none",
                    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>Save</button>
                  <button onClick={() => setQuotingId(null)} style={{
                    background: "none", border: `1px solid ${t.border}`, borderRadius: 6,
                    padding: "6px 12px", fontSize: 12, color: t.textSoft, cursor: "pointer",
                  }}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{o.price || "—"}</span>
                  <StatusBadge status={o.status} />
                  {o.status === "pending_review" && (
                    <button onClick={() => startQuote(o.id)} style={{
                      background: t.gold, color: "#0A0A0A", border: "none",
                      padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      cursor: "pointer",
                    }}>Set Price</button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
