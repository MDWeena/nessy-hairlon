import { useEffect, useRef, useState } from "react";
import { Search, Calendar, Clock, Scissors, X, Star, Info, Upload, Package } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { lookupBookings, markDepositPaid } from "../hooks/useBookingLookup";
import type { TrackedBooking } from "../hooks/useBookingLookup";
import { useSettings } from "../hooks/useSettings";
import { uploadToCloudinary } from "../lib/cloudinary";
import { calculateDepositAmount, sumMaterials } from "../lib/payments";
import { RESCHEDULABLE_STATUSES, blockReasonMessage, getRescheduleEligibility } from "../lib/reschedule";
import type { NavigateFn, OrderStatus } from "../types";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { StatusBadge } from "../components/ui/StatusBadge";
import { GoldSpinner } from "../components/ui/GoldSpinner";
import { PullToRefresh } from "../components/ui/PullToRefresh";
import { ClientReschedulePanel, WhatsAppNessyLink } from "../components/booking/ClientReschedulePanel";
import { cancelAsClient, contactProof } from "../lib/rescheduleApi";

interface TrackBookingPageProps {
  navigate: NavigateFn;
  initialReference?: string | null;
  onConsumeInitialReference?: () => void;
}

type ActionMode = "reschedule" | "cancel" | "pay";

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

export function TrackBookingPage({ navigate, initialReference, onConsumeInitialReference }: TrackBookingPageProps) {
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

  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const looksLikeReference = /[a-z]/i.test(query.trim());
  // Same fallback as useAvailability when the setting hasn't loaded: err toward more notice.
  const noticeHours = settings.min_booking_notice_hours ?? 24;

  const depositAmount = (booking: TrackedBooking): number | null =>
    calculateDepositAmount(booking, settings.deposit_percentage ?? null);

  const runSearch = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) { setError("Enter your booking reference or phone number"); return; }
    setLoading(true);
    setError(null);
    setResults(null);
    closeAction();
    try {
      const refLike = /[a-z]/i.test(trimmed);
      const found = await lookupBookings(refLike ? { reference: trimmed } : { phone: trimmed });
      if (found.length === 0) setError("No booking found for that reference or phone number.");
      setResults(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => runSearch(query);

  // Arrived here via a "track this booking" link elsewhere on the site (e.g. a previous
  // booking card) — pre-fill the reference and run the search immediately.
  useEffect(() => {
    if (!initialReference) return;
    setQuery(initialReference);
    runSearch(initialReference);
    onConsumeInitialReference?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReference]);

  const openAction = (booking: TrackedBooking, mode: ActionMode) => {
    setActionBooking(booking);
    setActionMode(mode);
    setActionError(null);
    setActionSuccess(null);
    setVerifyPhone(!looksLikeReference ? query.trim() : "");
    setProofUrl(null);
  };

  const closeAction = () => {
    setActionBooking(null);
    setActionMode(null);
    setActionError(null);
    setProofUrl(null);
  };

  // The panel stays open to show its own success state; this just keeps the card in sync.
  const handleRescheduled = (reference: string, date: string, time: string) => {
    setResults(prev => prev?.map(b => b.reference === reference ? { ...b, date, time } : b) ?? prev);
    setActionBooking(prev => prev && prev.reference === reference ? { ...prev, date, time } : prev);
  };

  const confirmCancel = async () => {
    if (!actionBooking) return;
    if (!verifyPhone.trim()) { setActionError("Enter the phone number or email you booked with"); return; }
    const ref = actionBooking.reference;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await cancelAsClient(ref, contactProof(verifyPhone));
      setActionSuccess(res.notifications.clientEmail === "sent"
        ? "Your booking has been cancelled. We've emailed you a confirmation."
        : "Your booking has been cancelled.");
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
    <PullToRefresh onRefresh={() => (results ? runSearch(query) : undefined)}>
    <section className="pt-12 px-6 pb-[72px] max-w-[560px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">TRACK BOOKING</p>
        <h2 className="font-cursive text-5xl font-bold mb-3">
          Check your status
        </h2>
        <p className="text-[15px] text-text-soft mb-8 leading-[1.6]">
          Enter your booking reference or the phone number you booked with.
        </p>
      </FadeIn>

      <div className="flex gap-2 mb-5">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g. BK-A3BF7FC4 or 080..."
          className="flex-1 py-3 px-3.5 rounded-[10px] border border-border bg-bg-alt text-sm text-text outline-none box-border"
        />
        <GoldButton
          onClick={handleSearch} disabled={loading}
          className={`bg-gold text-theme-black border-none py-0 px-5 rounded-[10px] text-sm font-bold flex items-center gap-2 ${loading ? "cursor-wait" : "cursor-pointer"}`}
        >
          {loading ? <GoldSpinner size={16} /> : <Search size={16} />} {loading ? "Searching…" : "Search"}
        </GoldButton>
      </div>

      {error && <ErrorNotice message={error} />}

      {results && results.length > 0 && (
        <div className="grid gap-4">
          {results.map(b => {
            const canCancel = b.status === "confirmed" || b.status === "quoted";
            const canReschedule = RESCHEDULABLE_STATUSES.includes(b.status);
            // The reschedule count isn't in lookup_bookings (which must not change), so the limit
            // is only known after the panel's verify step — but the notice window can be shown now.
            const preview = getRescheduleEligibility({
              status: b.status, date: b.date, time: b.time, clientRescheduleCount: 0,
              noticeHours, actor: "client", now: Date.now(),
            });
            const tooSoon = canReschedule && preview.reason === "TOO_LATE";
            const isActingOnThis = actionBooking?.reference === b.reference;
            const statusCopy = describeStatus(b.status, b);
            const deposit = depositAmount(b);
            return (
              <div key={b.reference} className="bg-surface rounded-2xl p-6 border border-border">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[13px] font-bold text-gold">{b.reference}</span>
                  <StatusBadge status={b.status} />
                </div>

                <div className="flex items-start gap-2 bg-gold-bg border border-[#C49A6C20] rounded-[10px] py-2.5 px-3.5 mb-4">
                  <Info size={14} color={t.gold} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[13px] font-bold text-text">{statusCopy.heading}</div>
                    <div className="text-xs text-text-soft mt-0.5">{statusCopy.body}</div>
                  </div>
                </div>

                <div className="grid gap-2.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[13px] flex items-center gap-1.5"><Calendar size={13} /> Date</span>
                    <span className="text-[13px] font-semibold">{b.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[13px] flex items-center gap-1.5"><Clock size={13} /> Time</span>
                    <span className="text-[13px] font-semibold">{b.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[13px] flex items-center gap-1.5"><Scissors size={13} /> Service</span>
                    <span className="text-[13px] font-semibold text-right">
                      {b.serviceNames.length > 0 ? b.serviceNames.join(", ") : (b.customStyleUrl ? "Custom style" : "—")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[13px]">Price</span>
                    <span className={`text-[13px] font-bold ${b.quotedPrice != null ? "text-text" : "text-gold"}`}>
                      {b.quotedPrice != null ? `₦${b.quotedPrice.toLocaleString()}` : "Pending"}
                    </span>
                  </div>
                  {b.attachmentPreference && (
                    <div className="flex justify-between">
                      <span className="text-text-muted text-[13px] flex items-center gap-1.5"><Package size={13} /> Attachments</span>
                      <span className="text-[13px] font-semibold">
                        {b.attachmentPreference === "client_provides" ? "I bring my own" : "Nessy purchases"}
                      </span>
                    </div>
                  )}
                  {b.customStyleDescription && (
                    <div className="border-t border-border pt-2.5 mt-0.5">
                      <span className="text-text-muted text-xs block mb-1">Style notes</span>
                      <span className="text-[13px]">{b.customStyleDescription}</span>
                    </div>
                  )}
                </div>
                {b.customStyleUrl && (
                  <a href={b.customStyleUrl} target="_blank" rel="noopener noreferrer" className="block mt-4">
                    <img src={b.customStyleUrl} alt="Requested style" className="w-full max-h-40 object-cover rounded-[10px] border border-border" />
                  </a>
                )}

                {/* Quoted: deposit + payment details + "I've Paid" */}
                {b.status === "quoted" && !isActingOnThis && (
                  <div className="mt-4 pt-4 border-t border-border">
                    {(settings.bank_name || settings.account_number) && (
                      <div className="bg-bg-alt rounded-[10px] p-3.5 mb-3 text-[13px] leading-[1.8]">
                        {b.attachmentPreference === "nessy_buys" && b.hairServiceCost != null && (
                          <>
                            <div className="mb-1">
                              <span className="text-text-muted">Hair service:</span> <strong>₦{b.hairServiceCost.toLocaleString()}</strong>
                            </div>
                            {b.attachmentItems.length > 0 && (
                              <div className="mb-1">
                                <span className="text-text-muted">Attachments:</span> <strong>₦{sumMaterials(b.attachmentItems).toLocaleString()}</strong>
                                <div className="text-[11px] text-text-muted pl-2 mt-0.5">
                                  {b.attachmentItems.map((item, i) => (
                                    <div key={i}>{item.type} × {item.quantity} @ ₦{item.unitCost.toLocaleString()}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {b.accessoryItems.length > 0 && (
                              <div className="mb-1">
                                <span className="text-text-muted">Accessories:</span> <strong>₦{sumMaterials(b.accessoryItems).toLocaleString()}</strong>
                                <div className="text-[11px] text-text-muted pl-2 mt-0.5">
                                  {b.accessoryItems.map((item, i) => (
                                    <div key={i}>{item.type} × {item.quantity} @ ₦{item.unitCost.toLocaleString()}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="border-t border-border pt-1.5 mt-1.5 mb-1.5">
                              <span className="text-text-muted">Total:</span> <strong>₦{b.quotedPrice!.toLocaleString()}</strong>
                            </div>
                            <div>
                              <span className="text-text-muted">Deposit due:</span> <strong className="text-gold">₦{deposit!.toLocaleString()}</strong>
                              <div className="text-[11px] text-text-muted mt-0.5">Full materials cost + 50% hair service</div>
                            </div>
                          </>
                        )}
                        {(b.attachmentPreference !== "nessy_buys" || b.hairServiceCost == null) && deposit != null && (
                          <div className="mb-1.5">
                            <span className="text-text-muted">Deposit ({settings.deposit_percentage}%):</span> <strong className="text-gold">₦{deposit.toLocaleString()}</strong>
                          </div>
                        )}
                        <div><span className="text-text-muted">Bank:</span> <strong>{settings.bank_name}</strong></div>
                        <div><span className="text-text-muted">Account:</span> <strong>{settings.account_number}</strong></div>
                        <div><span className="text-text-muted">Name:</span> <strong>{settings.account_name}</strong></div>
                      </div>
                    )}
                    <button
                      onClick={() => openAction(b, "pay")}
                      className="w-full bg-gold text-theme-black border-none py-2.5 rounded-lg text-[13px] font-bold cursor-pointer"
                    >I've Paid My Deposit</button>
                  </div>
                )}

                {(canReschedule || canCancel) && !isActingOnThis && (
                  <div className={`mt-4 ${b.status === "quoted" ? "pt-0 border-t-0" : "pt-4 border-t border-border"}`}>
                    {tooSoon && (
                      <div className="grid gap-2.5 mb-2.5">
                        <p className="text-xs text-text-soft leading-[1.6] m-0">{blockReasonMessage("TOO_LATE", noticeHours)}</p>
                        <WhatsAppNessyLink booking={b} nessyPhone={settings.phone} />
                      </div>
                    )}
                    <div className="flex gap-2">
                      {canReschedule && !tooSoon && (
                        <button
                          onClick={() => openAction(b, "reschedule")}
                          className="flex-1 bg-gold-bg border border-[#C49A6C30] text-gold py-2 rounded-lg text-xs font-bold cursor-pointer"
                        >Reschedule</button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => openAction(b, "cancel")}
                          className="flex-1 bg-transparent border border-[#EF444440] text-[#EF4444] py-2 rounded-lg text-xs font-bold cursor-pointer"
                        >Cancel</button>
                      )}
                    </div>
                  </div>
                )}

                {b.status === "completed" && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => navigate("review")}
                      className="w-full bg-gold-bg border border-[#C49A6C30] text-gold py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    ><Star size={13} /> Leave a review</button>
                  </div>
                )}

                {isActingOnThis && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-3.5">
                      <h4 className="text-sm font-bold">
                        {actionMode === "reschedule" ? "Reschedule appointment" : actionMode === "cancel" ? "Cancel appointment" : "Confirm your deposit"}
                      </h4>
                      <button className="tap-target-sm bg-transparent border-none cursor-pointer p-1 flex" onClick={closeAction}>
                        <X size={16} color={t.textMuted} />
                      </button>
                    </div>

                    {actionError && <ErrorNotice message={actionError} />}

                    {actionMode === "reschedule" ? (
                      <ClientReschedulePanel
                        booking={b}
                        initialContact={verifyPhone}
                        nessyPhone={settings.phone}
                        noticeHours={noticeHours}
                        onRescheduled={(date, time) => handleRescheduled(b.reference, date, time)}
                      />
                    ) : (
                      <>
                        <div className="mb-4">
                          <label className="block text-xs text-text-muted mb-1.5 font-medium">
                            {actionMode === "cancel" ? "Confirm the phone number or email you booked with" : "Confirm the phone number you booked with"}
                          </label>
                          <input
                            value={verifyPhone} onChange={(e) => setVerifyPhone(e.target.value)}
                            placeholder={actionMode === "cancel" ? "080... or you@example.com" : "080..."}
                            className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border"
                          />
                        </div>

                        {actionMode === "cancel" && (
                          <>
                            <p className="text-[13px] text-text-soft leading-[1.6] mb-4">
                              Are you sure? If you paid a deposit, it may not be refundable.
                            </p>
                            <div className="flex gap-2.5">
                              <button
                                onClick={closeAction}
                                className="flex-1 bg-surface text-text border border-border py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer"
                              >Never mind</button>
                              <button
                                onClick={confirmCancel} disabled={actionBusy}
                                className={`flex-1 bg-[#EF4444] text-white border-none py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 ${actionBusy ? "cursor-wait" : "cursor-pointer"}`}
                              >{actionBusy && <GoldSpinner size={14} />} {actionBusy ? "Cancelling…" : "Yes, cancel"}</button>
                            </div>
                          </>
                        )}

                        {actionMode === "pay" && (
                          <>
                            <p className="text-[13px] text-text-soft leading-[1.6] mb-3">
                              Optionally attach a screenshot of your transfer, then confirm below.
                            </p>
                            <input ref={proofInputRef} type="file" accept="image/*" className="hidden" onChange={handleProofChange} />
                            {proofUrl ? (
                              <div className="flex items-center gap-3 mb-4">
                                <img src={proofUrl} alt="Payment proof" className="w-12 h-12 rounded-lg object-cover border border-border" />
                                <button
                                  onClick={() => setProofUrl(null)}
                                  className="bg-transparent border border-[#EF444440] rounded-md py-[5px] px-3 text-xs text-[#EF4444] cursor-pointer"
                                >Remove</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => proofInputRef.current?.click()} disabled={proofUploading}
                                className={`bg-bg-alt border border-dashed border-border rounded-lg py-2.5 px-3.5 text-xs text-text-soft flex items-center gap-2 mb-4 w-full justify-center ${proofUploading ? "cursor-wait" : "cursor-pointer"}`}
                              >
                                {proofUploading ? <GoldSpinner size={14} /> : <Upload size={14} />}
                                {proofUploading ? "Uploading…" : "Attach payment screenshot (optional)"}
                              </button>
                            )}
                            <GoldButton
                              onClick={confirmPaid} disabled={actionBusy}
                              className={`w-full bg-gold text-theme-black border-none py-3 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 ${actionBusy ? "cursor-wait" : "cursor-pointer"}`}
                            >{actionBusy && <GoldSpinner size={14} color="#0A0A0A" />} {actionBusy ? "Submitting…" : "Confirm I've Paid"}</GoldButton>
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
        <div className="mt-5 bg-gold-bg border border-[#C49A6C30] rounded-[10px] py-3 px-4 text-[13px] text-text">
          {actionSuccess}
        </div>
      )}
    </section>
    </PullToRefresh>
  );
}
