import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronLeft, MessageCircle, X } from "lucide-react";
import { useAvailability } from "../../hooks/useAvailability";
import { formatSlot } from "../../lib/reschedule";
import { RescheduleRequestError, rescheduleAsAdmin, type AdminRescheduleResponse } from "../../lib/rescheduleApi";
import type { Order } from "../../types";
import { StepDateTime } from "../booking/StepDateTime";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";
import { LoadingNotice } from "../ui/LoadingNotice";
import { RescheduleHistory } from "./RescheduleHistory";

type Step = "pick" | "confirm" | "done";

interface AdminReschedulePanelProps {
  order: Order;
  onClose: () => void;
  onRescheduled: () => void;
}

const REASON_MAX = 500;

/** Admin reschedule: no notice window or client-reschedule limit, but still only slots that
 * are genuinely free (enforced again by reschedule_booking() server-side). */
export function AdminReschedulePanel({ order, onClose, onRescheduled }: AdminReschedulePanelProps) {
  const [step, setStep] = useState<Step>("pick");
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminRescheduleResponse | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  // The order's original slot, pinned so the picker's exclusion doesn't jump once the
  // parent list refreshes with the new time.
  const [original] = useState({ date: order.date, time: order.time });

  const { bookingDays, loading, refetch } = useAvailability(14, { exclude: original, ignoreNotice: true });
  const selectedDay = selectedDayIdx !== null ? bookingDays[selectedDayIdx] : null;

  const confirm = async () => {
    if (!selectedDay || !selectedTime) return;
    setBusy(true);
    setError(null);
    try {
      const res = await rescheduleAsAdmin(order.id, selectedDay.date, selectedTime, reason.trim() || null);
      setResult(res);
      setStep("done");
      setHistoryKey(k => k + 1);
      onRescheduled();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reschedule";
      setError(message);
      if (err instanceof RescheduleRequestError && (err.code === "SLOT_UNAVAILABLE" || err.code === "SAME_SLOT")) {
        setSelectedTime(null);
        setStep("pick");
        refetch();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[13px] font-bold m-0">Reschedule {order.client}</h4>
        <button onClick={onClose} aria-label="Close" className="tap-target-sm bg-transparent border-none cursor-pointer p-1 flex text-text-muted">
          <X size={15} />
        </button>
      </div>

      {error && <ErrorNotice message={error} />}

      {step === "pick" && (
        loading ? <LoadingNotice label="Loading available times…" /> : bookingDays.length === 0 ? (
          <p className="text-xs text-text-muted">No open slots in the next two weeks.</p>
        ) : (
          <StepDateTime
            bookingDays={bookingDays}
            selectedDayIdx={selectedDayIdx}
            onSelectDay={(idx) => { setSelectedDayIdx(idx); setSelectedTime(null); }}
            selectedTime={selectedTime}
            onSelectTime={setSelectedTime}
            onContinue={() => { setError(null); setStep("confirm"); }}
            currentSlot={original}
          />
        )
      )}

      {step === "confirm" && selectedDay && selectedTime && (
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="bg-bg-alt border border-border rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-0.5">Current</div>
              <div className="text-xs font-semibold text-text-soft line-through">{formatSlot(original.date, original.time)}</div>
            </div>
            <ArrowRight size={14} className="text-gold" />
            <div className="bg-gold-bg border border-gold rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-[1px] text-gold mb-0.5">New</div>
              <div className="text-xs font-bold text-text">{formatSlot(selectedDay.date, selectedTime)}</div>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-text-muted font-semibold mb-1 flex justify-between">
              <span>Reason (optional — shown to the client)</span>
              <span className="font-normal">{reason.length}/{REASON_MAX}</span>
            </label>
            <textarea
              value={reason} onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              rows={2} placeholder="e.g. Nessy is travelling that day"
              className="w-full py-2 px-2.5 rounded-md border border-border bg-bg-alt text-xs text-text outline-none box-border [font-family:inherit] resize-y"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setStep("pick")} disabled={busy}
              className="bg-transparent border border-border rounded-md py-1.5 px-3 text-xs text-text-soft cursor-pointer flex items-center gap-1"
            ><ChevronLeft size={12} /> Back</button>
            <button
              onClick={confirm} disabled={busy}
              className={`bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-xs font-bold flex items-center gap-1.5 ${busy ? "cursor-wait" : "cursor-pointer"}`}
            >{busy && <GoldSpinner size={12} color="#0A0A0A" />} {busy ? "Saving…" : "Confirm reschedule"}</button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="grid gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text">
            <Check size={14} className="text-gold" /> Moved to {formatSlot(result.booking.date, result.booking.time)}
          </div>
          {result.notifications.clientEmail === "sent" && (
            <p className="text-xs text-text-soft m-0">The client has been emailed the new time.</p>
          )}
          {result.notifications.whatsappUrl && (
            <div className="bg-[#F59E0B15] border border-[#F59E0B40] rounded-lg p-2.5 grid gap-2">
              <p className="text-xs text-text m-0 flex items-start gap-1.5">
                <AlertTriangle size={13} className="text-[#F59E0B] shrink-0 mt-px" />
                {result.notifications.clientEmail === "no_email"
                  ? "This client has no email — notify them on WhatsApp."
                  : "The client email couldn't be sent — notify them on WhatsApp."}
              </p>
              <a
                href={result.notifications.whatsappUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 bg-[#22c55e] text-white no-underline py-2 rounded-md text-xs font-bold"
              ><MessageCircle size={13} /> Message client on WhatsApp</a>
            </div>
          )}
          {result.notifications.adminEmail === "failed" && (
            <p className="text-[11px] text-text-muted m-0">Your copy of the confirmation email couldn't be sent — the reschedule itself is saved.</p>
          )}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-dashed border-border">
        <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-1.5">Reschedule history</div>
        <RescheduleHistory bookingId={order.id} refreshKey={historyKey} />
      </div>
    </div>
  );
}
