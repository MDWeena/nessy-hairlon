import { useEffect, useRef, useState } from "react";
import { statusColors } from "../../constants/statusColors";
import { useBookings } from "../../hooks/useBookings";
import { useSettings } from "../../hooks/useSettings";
import { calculateBalanceAmount } from "../../lib/payments";
import { buildWhatsAppUrl } from "../../lib/whatsapp";
import { toISODateString, getWeekRange } from "../../lib/date";
import type { MaterialItem, Order, OrderFilter } from "../../types";
import { Plus, Trash2, CheckCircle2, Bell, MessageCircle, MailWarning } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";
import { MoneyInput } from "../ui/MoneyInput";

const FILTERS: Exclude<OrderFilter, "this_week_confirmed">[] = ["all", "pending_review", "quoted", "deposit_paid", "confirmed"];

const ITEM_INPUT = "py-1.5 px-2 rounded-md border border-border bg-bg-alt text-xs text-text outline-none";

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
  const { settings } = useSettings();
  const {
    bookings, loading, error, setQuotedPrice, updateBookingStatus, confirmDepositPayment, rejectDepositPayment,
    markBalancePaid, sendBalanceReminder,
  } = useBookings();
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
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
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to set price");
      }
    } else {
      const price = quoteValue;
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
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f} onClick={() => setFilter(f)}
            className={`py-[7px] px-4 rounded-full text-xs cursor-pointer border [transition:all_0.2s] ${
              filter === f ? "border-gold bg-gold-bg text-gold font-bold" : "border-border bg-transparent text-text-soft font-medium"
            }`}
          >{f === "all" ? "All" : statusColors[f]?.label}</button>
        ))}
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
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
          <div
            key={o.id} ref={isHighlighted ? highlightRef : undefined}
            className={`py-4 px-5 [transition:background_0.8s] ${i < filtered.length - 1 ? "border-b border-border" : "border-b-0"} ${
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
                    <div key={idx} className="flex gap-1.5 mb-1.5 items-center">
                      <input value={item.type} onChange={(e) => updateItem(attachItems, setAttachItems, idx, "type", e.target.value)} placeholder="Type" className={`flex-[2] ${ITEM_INPUT}`} />
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(attachItems, setAttachItems, idx, "quantity", e.target.value)} placeholder="Qty" className={`w-[50px] text-center ${ITEM_INPUT}`} />
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
                    <div key={idx} className="flex gap-1.5 mb-1.5 items-center">
                      <input value={item.type} onChange={(e) => updateItem(accessItems, setAccessItems, idx, "type", e.target.value)} placeholder="Type" className={`flex-[2] ${ITEM_INPUT}`} />
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(accessItems, setAccessItems, idx, "quantity", e.target.value)} placeholder="Qty" className={`w-[50px] text-center ${ITEM_INPUT}`} />
                      <MoneyInput value={item.unitCost} onChange={(v) => updateItem(accessItems, setAccessItems, idx, "unitCost", String(v))} placeholder="each" style={{ width: 80, fontSize: 12 }} />
                      <button onClick={() => removeItem(accessItems, setAccessItems, idx)} className="bg-transparent border-none text-[#EF4444] cursor-pointer p-0.5 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {accessItems.length > 0 && <div className="text-[11px] text-text-soft text-right">Subtotal: ₦{sumItems(accessItems).toLocaleString()}</div>}
                </div>

                {/* Total and actions */}
                <div className="border-t border-border pt-2.5 flex justify-between items-center">
                  <div className="text-[13px] font-bold">
                    Total: ₦{(hairCostValue + sumItems(attachItems) + sumItems(accessItems)).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setQuotingId(null)} className="bg-transparent border border-border rounded-md py-1.5 px-3 text-xs text-text-soft cursor-pointer">Cancel</button>
                    <button onClick={() => submitQuote(o.id)} className="bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-xs font-bold cursor-pointer">Save Quote</button>
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
