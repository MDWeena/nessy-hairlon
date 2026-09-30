import { useState } from "react";
import { statusColors } from "../../constants/statusColors";
import { useTheme } from "../../context/ThemeContext";
import { useBookings } from "../../hooks/useBookings";
import type { OrderFilter } from "../../types";
import { StatusBadge } from "../ui/StatusBadge";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

const FILTERS: OrderFilter[] = ["all", "pending_review", "quoted", "deposit_paid", "confirmed"];

interface OrdersProps {
  initialFilter?: OrderFilter;
}

export function Orders({ initialFilter = "all" }: OrdersProps) {
  const { t } = useTheme();
  const { bookings, loading, error, setQuotedPrice, updateBookingStatus, confirmDepositPayment, rejectDepositPayment } = useBookings();
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quoteValue, setQuoteValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const confirmWithoutDeposit = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      await updateBookingStatus(id, "confirmed");
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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update booking");
    } finally {
      setBusyId(null);
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
            padding: "16px 20px",
            borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none",
            transition: "background 0.2s",
          }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", rowGap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              {o.customStyleUrl ? (
                <a href={o.customStyleUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }} title="Open full photo">
                  <img src={o.customStyleUrl} alt="Requested style" style={{
                    width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `1px solid ${t.gold}40`, cursor: "pointer",
                  }} />
                </a>
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}10)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 700, color: t.gold,
                }}>{o.client[0]}</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.client}</div>
                <div style={{ fontSize: 12, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.service}</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{o.date} at {o.time}</div>
                {o.customStyleDescription && (
                  <div style={{ fontSize: 11, color: t.textSoft, marginTop: 4, fontStyle: "italic", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    "{o.customStyleDescription}"
                  </div>
                )}
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

          {o.status === "quoted" && quotingId !== o.id && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}`, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Waiting for client deposit</span>
              <button onClick={() => confirmWithoutDeposit(o.id)} disabled={busyId === o.id} style={{
                background: "none", border: `1px solid ${t.border}`, borderRadius: 6,
                padding: "6px 12px", fontSize: 11, color: t.textSoft, cursor: busyId === o.id ? "wait" : "pointer",
              }}>{busyId === o.id ? "Confirming…" : "Confirm without deposit"}</button>
            </div>
          )}

          {o.status === "deposit_paid" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}`, gap: 12, flexWrap: "wrap" }}>
              {o.paymentProofUrl ? (
                <a href={o.paymentProofUrl} target="_blank" rel="noopener noreferrer" title="Open payment proof" style={{ flexShrink: 0 }}>
                  <img src={o.paymentProofUrl} alt="Payment proof" style={{
                    width: 36, height: 36, borderRadius: 6, objectFit: "cover", border: `1px solid ${t.gold}40`, cursor: "pointer",
                  }} />
                </a>
              ) : (
                <span style={{ fontSize: 12, color: t.textMuted }}>No payment screenshot attached</span>
              )}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => handlePaymentNotFound(o.id)} disabled={busyId === o.id} style={{
                  background: "none", border: "1px solid #EF444440", borderRadius: 6,
                  padding: "6px 12px", fontSize: 11, color: "#EF4444", cursor: busyId === o.id ? "wait" : "pointer",
                }}>Payment Not Found</button>
                <button onClick={() => handleConfirmPayment(o.id)} disabled={busyId === o.id} style={{
                  background: t.gold, color: "#0A0A0A", border: "none",
                  padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  cursor: busyId === o.id ? "wait" : "pointer",
                }}>{busyId === o.id ? "Confirming…" : "Confirm Payment"}</button>
              </div>
            </div>
          )}
          </div>
        ))}
      </div>
    </>
  );
}
