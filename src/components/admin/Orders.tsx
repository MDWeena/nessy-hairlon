import { useEffect, useRef, useState } from "react";
import { statusColors } from "../../constants/statusColors";
import { useTheme } from "../../context/ThemeContext";
import { useBookings } from "../../hooks/useBookings";
import { useSettings } from "../../hooks/useSettings";
import { calculateBalanceAmount } from "../../lib/payments";
import { buildWhatsAppUrl } from "../../lib/whatsapp";
import { toISODateString, getWeekRange } from "../../lib/date";
import type { MaterialItem, Order, OrderFilter } from "../../types";
import { Package, Plus, Trash2, CheckCircle2, Bell, MessageCircle, MailWarning } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";

const FILTERS: Exclude<OrderFilter, "this_week_confirmed">[] = ["all", "pending_review", "quoted", "deposit_paid", "confirmed"];

function buildBalanceWhatsAppMessage(
  o: Order,
  balanceDue: number,
  settings: { bank_name?: string; account_number?: string; account_name?: string },
): string {
  return `Hi ${o.client}, this is Nessy Hairlon. Your appointment on ${o.date} is complete but we haven't received the remaining balance of ₦${balanceDue.toLocaleString()}. Please transfer to ${settings.bank_name ?? ""} - ${settings.account_number ?? ""} - ${settings.account_name ?? ""}. Thank you!`;
}

interface OrdersProps {
  initialFilter?: OrderFilter;
  highlightBookingId?: string | null;
}

export function Orders({ initialFilter = "all", highlightBookingId }: OrdersProps) {
  const { t } = useTheme();
  const { settings } = useSettings();
  const {
    bookings, loading, error, setQuotedPrice, updateBookingStatus, confirmDepositPayment, rejectDepositPayment,
    markBalancePaid, sendBalanceReminder,
  } = useBookings();
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quoteValue, setQuoteValue] = useState("");
  const [hairCostValue, setHairCostValue] = useState("");
  const [attachItems, setAttachItems] = useState<MaterialItem[]>([]);
  const [accessItems, setAccessItems] = useState<MaterialItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [balanceActionId, setBalanceActionId] = useState<string | null>(null);
  const [reminderActionId, setReminderActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [highlightFading, setHighlightFading] = useState(false);
  const filtered = filter === "all"
    ? bookings
    : filter === "this_week_confirmed"
      ? (() => {
          const { start, end } = getWeekRange(new Date());
          return bookings.filter(o =>
            (o.status === "confirmed" || o.status === "completed") && o.date >= start && o.date <= end,
          );
        })()
      : bookings.filter(o => o.status === filter);

  // Scroll to and briefly highlight a deep-linked booking
  useEffect(() => {
    if (!highlightBookingId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightFading(true), 2500);
    return () => clearTimeout(timer);
  }, [highlightBookingId, loading]);

  const startQuote = (id: string) => {
    setActionError(null);
    setQuotingId(id);
    setQuoteValue("");
    setHairCostValue("");
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
      const hairCost = parseInt(hairCostValue, 10);
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
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to set price");
      }
    } else {
      const price = parseInt(quoteValue, 10);
      if (!price || price <= 0) { setActionError("Enter a valid price"); return; }
      try {
        await setQuotedPrice(id, price);
        setQuotingId(null);
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

  const handleMarkBalancePaid = async (id: string) => {
    setActionError(null);
    setBalanceActionId(id);
    try {
      await markBalancePaid(id);
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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setReminderActionId(null);
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
        {filtered.map((o, i) => {
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
          <div key={o.id} ref={isHighlighted ? highlightRef : undefined} style={{
            padding: "16px 20px",
            borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none",
            transition: "background 0.8s",
            background: isHighlighted && !highlightFading ? `${t.gold}18` : "transparent",
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
                {o.attachmentPreference && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, color: o.attachmentPreference === "nessy_buys" ? t.gold : t.textMuted }}>
                    <Package size={11} /> {o.attachmentPreference === "client_provides" ? "Client brings attachments" : "Nessy purchases attachments"}
                  </div>
                )}
                {!o.clientEmail && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4,
                    fontSize: 10, fontWeight: 600, color: "#F59E0B", background: "#F59E0B15",
                    padding: "2px 7px", borderRadius: 10,
                  }}>
                    <MailWarning size={10} /> No email
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              {quotingId === o.id ? (
                o.attachmentPreference ? (
                  <div style={{ fontSize: 12, color: t.textSoft }}>Quoting below…</div>
                ) : (
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
                )
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
                display: "flex", alignItems: "center", gap: 6,
              }}>{busyId === o.id && <GoldSpinner size={12} />} {busyId === o.id ? "Confirming…" : "Confirm without deposit"}</button>
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
                  display: "flex", alignItems: "center", gap: 6,
                }}>{busyId === o.id && <GoldSpinner size={12} color="#0A0A0A" />} {busyId === o.id ? "Confirming…" : "Confirm Payment"}</button>
              </div>
            </div>
          )}

          {showBalanceSection && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
              {o.balancePaidAt ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#10B981" }}>
                  <CheckCircle2 size={14} /> Fully Paid
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>
                    Balance due: <strong style={{ color: t.text }}>{balanceDue != null ? `₦${balanceDue.toLocaleString()}` : "—"}</strong>
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {datePassed && balanceDue != null && balanceDue > 0 && (
                      o.clientEmail ? (
                        <button onClick={() => handleSendReminder(o.id)} disabled={reminderActionId === o.id} style={{
                          background: t.goldBg, border: `1px solid ${t.gold}30`, borderRadius: 6,
                          padding: "6px 12px", fontSize: 11, fontWeight: 600, color: t.gold,
                          cursor: reminderActionId === o.id ? "wait" : "pointer",
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          {reminderActionId === o.id ? <GoldSpinner size={12} /> : <Bell size={12} />}
                          {reminderActionId === o.id ? "Sending…" : o.balanceReminderSentAt ? "Resend Reminder" : "Send Balance Reminder"}
                        </button>
                      ) : (
                        <a
                          href={buildWhatsAppUrl(o.clientPhone, buildBalanceWhatsAppMessage(o, balanceDue, settings))}
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            background: "#22c55e", color: "#fff", border: "none", borderRadius: 6,
                            padding: "6px 12px", fontSize: 11, fontWeight: 600, textDecoration: "none",
                            display: "flex", alignItems: "center", gap: 6,
                          }}
                        ><MessageCircle size={12} /> WhatsApp Reminder</a>
                      )
                    )}
                    <button onClick={() => handleMarkBalancePaid(o.id)} disabled={balanceActionId === o.id} style={{
                      background: t.gold, color: "#0A0A0A", border: "none",
                      padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      cursor: balanceActionId === o.id ? "wait" : "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {balanceActionId === o.id && <GoldSpinner size={12} color="#0A0A0A" />}
                      {balanceActionId === o.id ? "Marking…" : "Mark Balance Paid"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {quotingId === o.id && o.attachmentPreference && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 4, display: "block" }}>Hair Service Cost</label>
                  <input type="number" value={hairCostValue} onChange={(e) => setHairCostValue(e.target.value)}
                    placeholder="₦ hair service" autoFocus
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                {/* Attachment items */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>Attachments</label>
                    <button onClick={() => addItem(attachItems, setAttachItems)} style={{ background: "none", border: "none", color: t.gold, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 2, padding: 0 }}>
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {attachItems.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                      <input value={item.type} onChange={(e) => updateItem(attachItems, setAttachItems, idx, "type", e.target.value)} placeholder="Type" style={{ flex: 2, padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgAlt, fontSize: 12, color: t.text, outline: "none" }} />
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(attachItems, setAttachItems, idx, "quantity", e.target.value)} placeholder="Qty" style={{ width: 50, padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgAlt, fontSize: 12, color: t.text, outline: "none", textAlign: "center" }} />
                      <input type="number" value={item.unitCost || ""} onChange={(e) => updateItem(attachItems, setAttachItems, idx, "unitCost", e.target.value)} placeholder="₦ each" style={{ width: 80, padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgAlt, fontSize: 12, color: t.text, outline: "none" }} />
                      <button onClick={() => removeItem(attachItems, setAttachItems, idx)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: 2, flexShrink: 0 }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {attachItems.length > 0 && <div style={{ fontSize: 11, color: t.textSoft, textAlign: "right" }}>Subtotal: ₦{sumItems(attachItems).toLocaleString()}</div>}
                </div>

                {/* Accessory items */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>Accessories</label>
                    <button onClick={() => addItem(accessItems, setAccessItems)} style={{ background: "none", border: "none", color: t.gold, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 2, padding: 0 }}>
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {accessItems.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                      <input value={item.type} onChange={(e) => updateItem(accessItems, setAccessItems, idx, "type", e.target.value)} placeholder="Type" style={{ flex: 2, padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgAlt, fontSize: 12, color: t.text, outline: "none" }} />
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(accessItems, setAccessItems, idx, "quantity", e.target.value)} placeholder="Qty" style={{ width: 50, padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgAlt, fontSize: 12, color: t.text, outline: "none", textAlign: "center" }} />
                      <input type="number" value={item.unitCost || ""} onChange={(e) => updateItem(accessItems, setAccessItems, idx, "unitCost", e.target.value)} placeholder="₦ each" style={{ width: 80, padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgAlt, fontSize: 12, color: t.text, outline: "none" }} />
                      <button onClick={() => removeItem(accessItems, setAccessItems, idx)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: 2, flexShrink: 0 }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {accessItems.length > 0 && <div style={{ fontSize: 11, color: t.textSoft, textAlign: "right" }}>Subtotal: ₦{sumItems(accessItems).toLocaleString()}</div>}
                </div>

                {/* Total and actions */}
                <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    Total: ₦{((parseInt(hairCostValue, 10) || 0) + sumItems(attachItems) + sumItems(accessItems)).toLocaleString()}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setQuotingId(null)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, color: t.textSoft, cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => submitQuote(o.id)} style={{ background: t.gold, color: "#0A0A0A", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save Quote</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
          );
        })}
      </div>
    </>
  );
}
