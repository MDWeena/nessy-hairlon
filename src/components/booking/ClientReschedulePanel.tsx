import { useState } from "react";
import { ArrowRight, CalendarClock, Check, ChevronLeft, MessageCircle } from "lucide-react";
import { useAvailability } from "../../hooks/useAvailability";
import type { TrackedBooking } from "../../hooks/useBookingLookup";
import {
  MAX_CLIENT_RESCHEDULES, blockReasonMessage, blockedRescheduleWhatsAppMessage, formatSlot, type RescheduleBlockReason,
} from "../../lib/reschedule";
import { RescheduleRequestError, checkClientReschedule, contactProof, rescheduleAsClient } from "../../lib/rescheduleApi";
import { buildWhatsAppUrl } from "../../lib/whatsapp";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldButton } from "../ui/GoldButton";
import { GoldSpinner } from "../ui/GoldSpinner";
import { LoadingNotice } from "../ui/LoadingNotice";
import { StepDateTime } from "./StepDateTime";

type Step = "verify" | "pick" | "confirm" | "blocked" | "done";

interface ClientReschedulePanelProps {
  booking: TrackedBooking;
  /** Prefilled when the client searched by phone number. */
  initialContact: string;
  nessyPhone: string | undefined;
  noticeHours: number;
  onRescheduled: (date: string, time: string) => void;
}

export function WhatsAppNessyLink({ booking, nessyPhone }: { booking: TrackedBooking; nessyPhone: string | undefined }) {
  return (
    <a
      href={buildWhatsAppUrl(nessyPhone, blockedRescheduleWhatsAppMessage(booking.reference, booking.date, booking.time))}
      target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1.5 w-full bg-[#22c55e] text-white no-underline py-2.5 rounded-lg text-[13px] font-bold"
    ><MessageCircle size={14} /> Message Nessy on WhatsApp</a>
  );
}

export function ClientReschedulePanel({ booking, initialContact, nessyPhone, noticeHours, onRescheduled }: ClientReschedulePanelProps) {
  const [step, setStep] = useState<Step>("verify");
  const [contact, setContact] = useState(initialContact);
  const [remaining, setRemaining] = useState<number>(MAX_CLIENT_RESCHEDULES);
  const [blockReason, setBlockReason] = useState<RescheduleBlockReason | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [newSlot, setNewSlot] = useState<{ date: string; time: string } | null>(null);

  const { bookingDays, loading: availabilityLoading, refetch } = useAvailability(14, {
    exclude: { date: booking.date, time: booking.time },
  });
  const selectedDay = selectedDayIdx !== null ? bookingDays[selectedDayIdx] : null;

  const block = (reason: RescheduleBlockReason) => {
    setBlockReason(reason);
    setStep("blocked");
  };

  const verify = async () => {
    if (!contact.trim()) { setError("Enter the phone number or email you booked with"); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await checkClientReschedule(booking.reference, contactProof(contact));
      setRemaining(res.eligibility.remaining ?? 0);
      if (!res.eligibility.eligible && res.eligibility.reason) block(res.eligibility.reason);
      else setStep("pick");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!selectedDay || !selectedTime) return;
    setBusy(true);
    setError(null);
    try {
      const res = await rescheduleAsClient(booking.reference, contactProof(contact), selectedDay.date, selectedTime);
      setRemaining(res.remaining);
      setEmailSent(res.notifications.clientEmail === "sent");
      setNewSlot({ date: res.booking.date, time: res.booking.time });
      setStep("done");
      onRescheduled(res.booking.date, res.booking.time);
    } catch (err) {
      if (err instanceof RescheduleRequestError) {
        if (err.code === "TOO_LATE" || err.code === "LIMIT_REACHED" || err.code === "INVALID_STATUS") {
          block(err.code);
        } else if (err.code === "SLOT_UNAVAILABLE" || err.code === "SAME_SLOT") {
          // Someone else took it (or it fell inside the notice window) since the calendar loaded.
          setError(err.message);
          setSelectedTime(null);
          setStep("pick");
          refetch();
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (step === "blocked" && blockReason) {
    return (
      <div className="grid gap-3">
        <p className="text-[13px] text-text-soft leading-[1.6] m-0">
          {blockReasonMessage(blockReason, noticeHours)} Nessy can help you find a new time.
        </p>
        <WhatsAppNessyLink booking={booking} nessyPhone={nessyPhone} />
      </div>
    );
  }

  if (step === "done" && newSlot) {
    return (
      <div className="bg-gold-bg border border-[#C49A6C30] rounded-[10px] p-4 text-[13px]">
        <div className="flex items-center gap-2 font-bold text-text mb-1.5"><Check size={15} className="text-gold" /> Appointment rescheduled</div>
        <p className="m-0 text-text-soft leading-[1.6]">
          You're now booked for <strong className="text-text">{formatSlot(newSlot.date, newSlot.time)}</strong>.
          {emailSent && " We've emailed you a confirmation."}
        </p>
        <p className="mt-2 mb-0 text-xs text-text-muted">Online reschedules remaining: {remaining} of {MAX_CLIENT_RESCHEDULES}</p>
      </div>
    );
  }

  return (
    <div>
      {error && <ErrorNotice message={error} />}

      {step === "verify" && (
        <>
          <label className="block text-xs text-text-muted mb-1.5 font-medium">
            Confirm the phone number or email you booked with
          </label>
          <input
            value={contact} onChange={(e) => setContact(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="080... or you@example.com"
            className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border mb-3"
          />
          <GoldButton
            onClick={verify} disabled={busy}
            className={`w-full bg-gold text-theme-black border-none py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 ${busy ? "cursor-wait" : "cursor-pointer"}`}
          >{busy ? <GoldSpinner size={14} color="#0A0A0A" /> : <CalendarClock size={14} />} {busy ? "Checking…" : "See available times"}</GoldButton>
        </>
      )}

      {step === "pick" && (
        availabilityLoading ? (
          <LoadingNotice label="Loading available times…" />
        ) : bookingDays.length === 0 ? (
          <div className="grid gap-3">
            <p className="text-[13px] text-text-soft m-0">There are no open times in the next two weeks right now.</p>
            <WhatsAppNessyLink booking={booking} nessyPhone={nessyPhone} />
          </div>
        ) : (
          <StepDateTime
            bookingDays={bookingDays}
            selectedDayIdx={selectedDayIdx}
            onSelectDay={(idx) => { setSelectedDayIdx(idx); setSelectedTime(null); }}
            selectedTime={selectedTime}
            onSelectTime={setSelectedTime}
            onContinue={() => { setError(null); setStep("confirm"); }}
            currentSlot={{ date: booking.date, time: booking.time }}
          />
        )
      )}

      {step === "confirm" && selectedDay && selectedTime && (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-3">
            <div className="bg-bg-alt border border-border rounded-[10px] p-3">
              <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-1">Current</div>
              <div className="text-[13px] font-semibold text-text-soft line-through">{formatSlot(booking.date, booking.time)}</div>
            </div>
            <ArrowRight size={16} className="text-gold" />
            <div className="bg-gold-bg border border-gold rounded-[10px] p-3">
              <div className="text-[10px] uppercase tracking-[1px] text-gold mb-1">New</div>
              <div className="text-[13px] font-bold text-text">{formatSlot(selectedDay.date, selectedTime)}</div>
            </div>
          </div>
          <p className="text-xs text-text-muted mb-4">
            Reschedules remaining: {remaining} of {MAX_CLIENT_RESCHEDULES} — this will use one.
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={() => setStep("pick")} disabled={busy}
              className="flex-1 bg-surface text-text border border-border py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1"
            ><ChevronLeft size={14} /> Back</button>
            <GoldButton
              onClick={confirm} disabled={busy}
              className={`flex-[2] bg-gold text-theme-black border-none py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 ${busy ? "cursor-wait" : "cursor-pointer"}`}
            >{busy && <GoldSpinner size={14} color="#0A0A0A" />} {busy ? "Rescheduling…" : "Confirm new time"}</GoldButton>
          </div>
        </>
      )}
    </div>
  );
}
