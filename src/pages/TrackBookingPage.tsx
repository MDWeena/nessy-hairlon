import { useRef, useState } from "react";
import { Search, Calendar, Clock, Scissors, X, Star, Info, Upload, Loader2, Package } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { lookupBookings, rescheduleBooking, cancelBooking, markDepositPaid } from "../hooks/useBookingLookup";
import type { TrackedBooking } from "../hooks/useBookingLookup";
import { useAvailability, hourFromLabel } from "../hooks/useAvailability";
import { useSettings } from "../hooks/useSettings";
import { uploadToCloudinary } from "../lib/cloudinary";
import type { NavigateFn, OrderStatus } from "../types";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { StatusBadge } from "../components/ui/StatusBadge";
import { StepDateTime } from "../components/booking/StepDateTime";

interface TrackBookingPageProps {
  navigate: NavigateFn;
}

type ActionMode = "reschedule" | "cancel" | "pay";

function isPastNoticeWindow(booking: TrackedBooking): boolean {
  const hour = hourFromLabel(booking.time);
  if (hour === null) return true;
  const appointment = new Date(`${booking.date}T00:00:00`);
  appointment.setHours(hour, 0, 0, 0);
  return appointment.getTime() - Date.now() < 24 * 60 * 60 * 1000;
}

function describeStatus(status: OrderStatus, booking: TrackedBooking): { heading: string; body: string } {
  switch (status) {
    case "pending_review":
      return { heading: "Under Review", body: "Nessy is reviewing your booking request." };
    case "quoted":
      return { heading: "Quote Ready", body: `Your quote is ${booking.quotedPrice != null ? `₦${booking.quotedPrice.toLocaleString()}` : "ready"}. Pay a deposit to confirm your appointment.` };
    case "deposit_paid":
      return { heading: "Payment Verification", body: "We've received your payment notification. Nessy will verify and confirm your appointment shortly." };
    case "confirmed":
      return { heading: "Confirmed ✓", body: `Your appointment is confirmed! See you on ${booking.date} at ${booking.time}.` };
    case "completed":
      return { heading: "Completed", body: "Thanks for visiting! We'd love your feedback." };
    case "cancelled":
      return { heading: "Cancelled", body: "This booking has been cancelled." };
  }
}

export function TrackBookingPage({ navigate }: TrackBookingPageProps) {
  const { t } = useTheme();
  const { settings } = useSettings();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TrackedBooking[] | null>(null);

  const [actionBooking, setActionBooking] = useState<TrackedBooking | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [verifyPhone, setVerifyPhone] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const { bookingDays, loading: availabilityLoading } = useAvailability();

  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const looksLikeReference = /[a-z]/i.test(query.trim());
  const sumMaterials = (items: { quantity: number; unitCost: number }[]) => items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const depositAmount = (booking: TrackedBooking): number | null => {
    if (booking.quotedPrice == null) return null;
    // If Nessy buys attachments: deposit = full materials cost + 50% of hair service
    if (booking.attachmentPreference === "nessy_buys" && booking.hairServiceCost != null) {
      const materialsCost = sumMaterials(booking.attachmentItems) + sumMaterials(booking.accessoryItems);
      return Math.round(materialsCost + booking.hairServiceCost * 0.5);
    }
    // Standard: deposit = quoted_price × deposit_percentage / 100
    if (settings.deposit_percentage != null) {
      return Math.round((booking.quotedPrice * settings.deposit_percentage) / 100);
    }
    return null;
  };

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) { setError("Enter your booking reference or phone number"); return; }
    setLoading(true);
    setError(null);
    setResults(null);
    closeAction();
    try {
      const found = await lookupBookings(looksLikeReference ? { reference: trimmed } : { phone: trimmed });
      if (found.length === 0) setError("No booking found for that reference or phone number.");
      setResults(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openAction = (booking: TrackedBooking, mode: ActionMode) => {
    setActionBooking(booking);
    setActionMode(mode);
    setActionError(null);
    setActionSuccess(null);
    setVerifyPhone(!looksLikeReference ? query.trim() : "");
    setSelectedDayIdx(null);
    setSelectedTime(null);
    setProofUrl(null);
  };

  const closeAction = () => {
    setActionBooking(null);
    setActionMode(null);
    setActionError(null);
    setProofUrl(null);
  };

  const confirmReschedule = async () => {
    if (!actionBooking || selectedDayIdx === null || !selectedTime) return;
    if (!verifyPhone.trim()) { setActionError("Enter the phone number you booked with"); return; }
    const day = bookingDays[selectedDayIdx];
    const ref = actionBooking.reference;
    setActionBusy(true);
    setActionError(null);
    try {
      await rescheduleBooking(actionBooking, verifyPhone.trim(), day.date, selectedTime);
      setActionSuccess(`Your appointment has been rescheduled to ${day.label} at ${selectedTime}.`);
      closeAction();
      setResults(prev => prev?.map(b => b.reference === ref ? { ...b, date: day.date, time: selectedTime } : b) ?? prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reschedule. Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (!actionBooking) return;
    if (!verifyPhone.trim()) { setActionError("Enter the phone number you booked with"); return; }
    const ref = actionBooking.reference;
    setActionBusy(true);
    setActionError(null);
    try {
      await cancelBooking(actionBooking, verifyPhone.trim());
      setActionSuccess("Your booking has been cancelled.");
      closeAction();
      setResults(prev => prev?.map(b => b.reference === ref ? { ...b, status: "cancelled" } : b) ?? prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel. Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProofUploading(true);
    setActionError(null);
    try {
      const url = await uploadToCloudinary(file);
      setProofUrl(url);
    } catch {
      setActionError("Upload failed, please try again");
    } finally {
      setProofUploading(false);
    }
  };

  const confirmPaid = async () => {
    if (!actionBooking) return;
    if (!verifyPhone.trim()) { setActionError("Enter the phone number you booked with"); return; }
    const ref = actionBooking.reference;
    setActionBusy(true);
    setActionError(null);
    try {
      await markDepositPaid(actionBooking, verifyPhone.trim(), proofUrl);
      setActionSuccess("Thanks! We've received your payment notification — Nessy will verify and confirm your appointment shortly.");
      closeAction();
      setResults(prev => prev?.map(b => b.reference === ref ? { ...b, status: "deposit_paid" } : b) ?? prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <section style={{ padding: "48px 24px 72px", maxWidth: 560, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>TRACK BOOKING</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 12 }}>
          Check your status
        </h2>
        <p style={{ fontSize: 15, color: t.textSoft, marginBottom: 32, lineHeight: 1.6 }}>
          Enter your booking reference or the phone number you booked with.
        </p>
      </FadeIn>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g. BK-A3BF7FC4 or 080..."
          style={{
            flex: 1, padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.border}`,
            background: t.bgAlt, fontSize: 14, color: t.text, outline: "none", boxSizing: "border-box",
          }}
        />
        <GoldButton onClick={handleSearch} disabled={loading} style={{
          background: t.gold, color: "#0A0A0A", border: "none",
          padding: "0 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
        }}>
          <Search size={16} /> {loading ? "Searching…" : "Search"}
        </GoldButton>
      </div>

      {error && <ErrorNotice message={error} />}

      {results && results.length > 0 && (
        <div style={{ display: "grid", gap: 16 }}>
          {results.map(b => {
            const canManage = b.status === "confirmed" || b.status === "quoted";
            const tooSoon = canManage && isPastNoticeWindow(b);
            const isActingOnThis = actionBooking?.reference === b.reference;
            const statusCopy = describeStatus(b.status, b);
            const deposit = depositAmount(b);
            return (
              <div key={b.reference} style={{
                background: t.surface, borderRadius: 16, padding: 24, border: `1px solid ${t.border}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.gold }}>{b.reference}</span>
                  <StatusBadge status={b.status} />
                </div>

                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8, background: t.goldBg,
                  border: `1px solid ${t.gold}20`, borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                }}>
                  <Info size={14} color={t.gold} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{statusCopy.heading}</div>
                    <div style={{ fontSize: 12, color: t.textSoft, marginTop: 2 }}>{statusCopy.body}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: t.textMuted, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={13} /> Date</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{b.date}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: t.textMuted, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Clock size={13} /> Time</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{b.time}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: t.textMuted, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Scissors size={13} /> Service</span>
                    <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>
                      {b.serviceNames.length > 0 ? b.serviceNames.join(", ") : (b.customStyleUrl ? "Custom style" : "—")}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: t.textMuted, fontSize: 13 }}>Price</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: b.quotedPrice != null ? t.text : t.gold }}>
                      {b.quotedPrice != null ? `₦${b.quotedPrice.toLocaleString()}` : "Pending"}
                    </span>
                  </div>
                  {b.attachmentPreference && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: t.textMuted, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Package size={13} /> Attachments</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {b.attachmentPreference === "client_provides" ? "I bring my own" : "Nessy purchases"}
                      </span>
                    </div>
                  )}
                  {b.customStyleDescription && (
                    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 10, marginTop: 2 }}>
                      <span style={{ color: t.textMuted, fontSize: 12, display: "block", marginBottom: 4 }}>Style notes</span>
                      <span style={{ fontSize: 13 }}>{b.customStyleDescription}</span>
                    </div>
                  )}
                </div>
                {b.customStyleUrl && (
                  <a href={b.customStyleUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 16 }}>
                    <img src={b.customStyleUrl} alt="Requested style" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 10, border: `1px solid ${t.border}` }} />
                  </a>
                )}

                {/* Quoted: deposit + payment details + "I've Paid" */}
                {b.status === "quoted" && !isActingOnThis && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                    {(settings.bank_name || settings.account_number) && (
                      <div style={{ background: t.bgAlt, borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 13, lineHeight: 1.8 }}>
                        {b.attachmentPreference === "nessy_buys" && b.hairServiceCost != null && (
                          <>
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ color: t.textMuted }}>Hair service:</span> <strong>₦{b.hairServiceCost.toLocaleString()}</strong>
                            </div>
                            {b.attachmentItems.length > 0 && (
                              <div style={{ marginBottom: 4 }}>
                                <span style={{ color: t.textMuted }}>Attachments:</span> <strong>₦{sumMaterials(b.attachmentItems).toLocaleString()}</strong>
                                <div style={{ fontSize: 11, color: t.textMuted, paddingLeft: 8, marginTop: 2 }}>
                                  {b.attachmentItems.map((item, i) => (
                                    <div key={i}>{item.type} × {item.quantity} @ ₦{item.unitCost.toLocaleString()}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {b.accessoryItems.length > 0 && (
                              <div style={{ marginBottom: 4 }}>
                                <span style={{ color: t.textMuted }}>Accessories:</span> <strong>₦{sumMaterials(b.accessoryItems).toLocaleString()}</strong>
                                <div style={{ fontSize: 11, color: t.textMuted, paddingLeft: 8, marginTop: 2 }}>
                                  {b.accessoryItems.map((item, i) => (
                                    <div key={i}>{item.type} × {item.quantity} @ ₦{item.unitCost.toLocaleString()}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 6, marginTop: 6, marginBottom: 6 }}>
                              <span style={{ color: t.textMuted }}>Total:</span> <strong>₦{b.quotedPrice!.toLocaleString()}</strong>
                            </div>
                            <div>
                              <span style={{ color: t.textMuted }}>Deposit due:</span> <strong style={{ color: t.gold }}>₦{deposit!.toLocaleString()}</strong>
                              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Full materials cost + 50% hair service</div>
                            </div>
                          </>
                        )}
                        {(b.attachmentPreference !== "nessy_buys" || b.hairServiceCost == null) && deposit != null && (
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ color: t.textMuted }}>Deposit ({settings.deposit_percentage}%):</span> <strong style={{ color: t.gold }}>₦{deposit.toLocaleString()}</strong>
                          </div>
                        )}
                        <div><span style={{ color: t.textMuted }}>Bank:</span> <strong>{settings.bank_name}</strong></div>
                        <div><span style={{ color: t.textMuted }}>Account:</span> <strong>{settings.account_number}</strong></div>
                        <div><span style={{ color: t.textMuted }}>Name:</span> <strong>{settings.account_name}</strong></div>
                      </div>
                    )}
                    <button onClick={() => openAction(b, "pay")} style={{
                      width: "100%", background: t.gold, color: "#0A0A0A", border: "none",
                      padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>I've Paid My Deposit</button>
                  </div>
                )}

                {canManage && !isActingOnThis && (
                  <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: b.status === "quoted" ? 0 : 16, borderTop: b.status === "quoted" ? "none" : `1px solid ${t.border}` }}>
                    <button onClick={() => openAction(b, "reschedule")} style={{
                      flex: 1, background: t.goldBg, border: `1px solid ${t.gold}30`, color: t.gold,
                      padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>Reschedule</button>
                    <button onClick={() => openAction(b, "cancel")} style={{
                      flex: 1, background: "none", border: "1px solid #EF444440", color: "#EF4444",
                      padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>Cancel</button>
                  </div>
                )}

                {b.status === "completed" && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                    <button onClick={() => navigate("review")} style={{
                      width: "100%", background: t.goldBg, border: `1px solid ${t.gold}30`, color: t.gold,
                      padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}><Star size={13} /> Leave a review</button>
                  </div>
                )}

                {isActingOnThis && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700 }}>
                        {actionMode === "reschedule" ? "Reschedule appointment" : actionMode === "cancel" ? "Cancel appointment" : "Confirm your deposit"}
                      </h4>
                      <button className="tap-target-sm" onClick={closeAction} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                        <X size={16} color={t.textMuted} />
                      </button>
                    </div>

                    {actionError && <ErrorNotice message={actionError} />}

                    {actionMode === "reschedule" && tooSoon ? (
                      <p style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.6 }}>
                        This appointment is too soon to reschedule online. Please call or WhatsApp Nessy directly.
                      </p>
                    ) : (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>
                            Confirm the phone number you booked with
                          </label>
                          <input
                            value={verifyPhone} onChange={(e) => setVerifyPhone(e.target.value)}
                            placeholder="080..." style={{
                              width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                              background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                            }}
                          />
                        </div>

                        {actionMode === "reschedule" && (
                          availabilityLoading ? (
                            <p style={{ fontSize: 13, color: t.textMuted }}>Loading available times…</p>
                          ) : (
                            <StepDateTime
                              bookingDays={bookingDays}
                              selectedDayIdx={selectedDayIdx}
                              onSelectDay={(idx) => { setSelectedDayIdx(idx); setSelectedTime(null); }}
                              selectedTime={selectedTime}
                              onSelectTime={setSelectedTime}
                              onContinue={confirmReschedule}
                            />
                          )
                        )}

                        {actionMode === "cancel" && (
                          <>
                            <p style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.6, marginBottom: 16 }}>
                              Are you sure? If you paid a deposit, it may not be refundable.
                            </p>
                            <div style={{ display: "flex", gap: 10 }}>
                              <button onClick={closeAction} style={{
                                flex: 1, background: t.surface, color: t.text, border: `1px solid ${t.border}`,
                                padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                              }}>Never mind</button>
                              <button onClick={confirmCancel} disabled={actionBusy} style={{
                                flex: 1, background: "#EF4444", color: "#fff", border: "none",
                                padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                                cursor: actionBusy ? "wait" : "pointer",
                              }}>{actionBusy ? "Cancelling…" : "Yes, cancel"}</button>
                            </div>
                          </>
                        )}

                        {actionMode === "pay" && (
                          <>
                            <p style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.6, marginBottom: 12 }}>
                              Optionally attach a screenshot of your transfer, then confirm below.
                            </p>
                            <input ref={proofInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleProofChange} />
                            {proofUrl ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                <img src={proofUrl} alt="Payment proof" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: `1px solid ${t.border}` }} />
                                <button onClick={() => setProofUrl(null)} style={{
                                  background: "none", border: `1px solid #EF444440`, borderRadius: 6,
                                  padding: "5px 12px", fontSize: 12, color: "#EF4444", cursor: "pointer",
                                }}>Remove</button>
                              </div>
                            ) : (
                              <button onClick={() => proofInputRef.current?.click()} disabled={proofUploading} style={{
                                background: t.bgAlt, border: `1px dashed ${t.border}`, borderRadius: 8,
                                padding: "10px 14px", fontSize: 12, color: t.textSoft, cursor: proofUploading ? "wait" : "pointer",
                                display: "flex", alignItems: "center", gap: 8, marginBottom: 16, width: "100%", justifyContent: "center",
                              }}>
                                {proofUploading ? <Loader2 size={14} style={{ animation: "loaderSpin 1s linear infinite" }} /> : <Upload size={14} />}
                                {proofUploading ? "Uploading…" : "Attach payment screenshot (optional)"}
                              </button>
                            )}
                            <GoldButton onClick={confirmPaid} disabled={actionBusy} style={{
                              width: "100%", background: t.gold, color: "#0A0A0A", border: "none",
                              padding: "12px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                              cursor: actionBusy ? "wait" : "pointer",
                            }}>{actionBusy ? "Submitting…" : "Confirm I've Paid"}</GoldButton>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {actionSuccess && (
        <div style={{
          marginTop: 20, background: t.goldBg, border: `1px solid ${t.gold}30`, borderRadius: 10,
          padding: "12px 16px", fontSize: 13, color: t.text,
        }}>{actionSuccess}</div>
      )}
    </section>
  );
}
