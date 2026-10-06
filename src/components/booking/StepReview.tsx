import { useEffect, useState } from "react";
import { Eye, Calendar, Clock, Scissors, Image, ChevronLeft, ChevronRight, Check, Mail, MessageCircle, Package, ExternalLink } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { createBooking } from "../../hooks/useBookings";
import { useSettings } from "../../hooks/useSettings";
import { shortBookingReference } from "../../lib/bookingReference";
import { isValidEmail, isValidNigerianPhone } from "../../lib/validation";
import { labelForUrl } from "../../lib/urlLabel";
import { buildWhatsAppUrl } from "../../lib/whatsapp";
import type { AttachmentPreference, BookingDay, NavigateFn, ServiceItem } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { GoldButton } from "../ui/GoldButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";

const MAX_NOTES_LENGTH = 500;

interface StepReviewProps {
  allServices: ServiceItem[];
  selectedDay: BookingDay | null;
  selectedTime: string | null;
  selectedServices: string[];
  uploadMode: boolean;
  customStyleUrl: string | null;
  customStyleDescription: string;
  styleReferenceUrls: string[];
  attachmentPreference: AttachmentPreference | null;
  onBack: () => void;
  navigate: NavigateFn;
}

export function StepReview({
  allServices, selectedDay, selectedTime, selectedServices, uploadMode,
  customStyleUrl, customStyleDescription, styleReferenceUrls, attachmentPreference, onBack, navigate,
}: StepReviewProps) {
  const { t } = useTheme();
  const { settings } = useSettings();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // The confirmation screen below swaps in without a step/URL change, so it needs its own
  // scroll-reset.
  useEffect(() => {
    if (reference) window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [reference]);

  const isCustom = !!customStyleUrl || styleReferenceUrls.length > 0;

  const handleConfirm = async () => {
    if (!selectedDay || !selectedTime) return;
    setSubmitError(null);
    if (!clientName.trim() || !clientPhone.trim()) {
      setSubmitError("Please enter your name and phone number");
      return;
    }
    // VALIDATION FIX (pre-launch audit): phone/email were accepted as unvalidated free
    // text — Nessy needs a working number to reach clients about their booking.
    if (!isValidNigerianPhone(clientPhone.trim())) {
      setSubmitError("Please enter a valid Nigerian phone number (e.g. 0816 127 1343)");
      return;
    }
    if (clientEmail.trim() && !isValidEmail(clientEmail.trim())) {
      setSubmitError("Please enter a valid email address, or leave it blank");
      return;
    }
    setSubmitting(true);
    try {
      const serviceIds = selectedServices
        .map(name => allServices.find(s => s.name === name)?.id)
        .filter((id): id is string => Boolean(id));
      const id = await createBooking({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || null,
        bookingDate: selectedDay.date,
        bookingTime: selectedTime,
        serviceIds,
        customStyleUrl,
        customStyleDescription: customStyleDescription.trim() || (isCustom ? "Custom style photo uploaded" : null),
        styleReferenceUrls,
        clientNotes: clientNotes.trim() || null,
        attachmentPreference,
      });
      setReference(shortBookingReference(id));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    const whatsappHref = buildWhatsAppUrl(settings.phone, `Hi Nessy, I have a question about my booking ${reference}`);
    return (
      <FadeIn>
        <div className="bg-surface rounded-2xl p-10 border border-border">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-gold-bg flex items-center justify-center mx-auto mt-0 mb-4">
              <Check size={26} color={t.gold} />
            </div>
            <h3 className="text-xl font-bold mb-2">Booking Request Submitted!</h3>
            <p className="text-sm text-text-soft leading-[1.6]">
              Thanks {clientName.trim()}! Your booking request has been received. Nessy will review it and send you a price quote within 24 hours.
            </p>
          </div>

          <div className="bg-gold-bg rounded-[10px] py-3 px-4 text-[13px] text-text-soft text-center mb-5 border border-[#C49A6C30]">
            Your reference: <strong className="text-gold">{reference}</strong>
          </div>

          <div className="grid gap-2.5 mb-5 pb-5 border-b border-border">
            <div className="flex justify-between">
              <span className="text-text-muted text-[13px] flex items-center gap-1.5"><Calendar size={13} /> Date</span>
              <span className="text-[13px] font-semibold">{selectedDay ? selectedDay.label : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted text-[13px] flex items-center gap-1.5"><Clock size={13} /> Time</span>
              <span className="text-[13px] font-semibold">{selectedTime || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted text-[13px] flex items-center gap-1.5"><Scissors size={13} /> Service</span>
              <span className="text-[13px] font-semibold text-right">
                {isCustom ? "Custom style (quote pending)" : selectedServices.join(", ") || "—"}
              </span>
            </div>
            {clientNotes.trim() && (
              <div className="pt-1">
                <span className="text-text-muted text-[13px] block mb-1">Your note to Nessy</span>
                <p className="text-[13px] text-text-soft italic">"{clientNotes.trim()}"</p>
              </div>
            )}
          </div>

          <div className="grid gap-2.5 text-[13px] text-text-soft mb-6">
            {clientEmail.trim() && (
              <div className="flex items-start gap-2">
                <Mail size={14} color={t.gold} className="shrink-0 mt-0.5" />
                <span>You'll receive an email at <strong className="text-text">{clientEmail.trim()}</strong> when your quote is ready.</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MessageCircle size={14} color={t.gold} className="shrink-0 mt-0.5" />
              <span>Questions? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-gold font-semibold">WhatsApp Nessy directly</a></span>
            </div>
          </div>

          <button
            onClick={() => navigate("track")}
            className="w-full bg-gold text-theme-black border-none py-3 text-sm font-bold cursor-pointer rounded-md flex items-center justify-center gap-1.5"
          >Track your booking status <ChevronRight size={16} /></button>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <div>
        <div className="bg-surface rounded-2xl p-7 mb-5 border border-border">
          <h3 className="text-base font-bold mb-5 pb-3 border-b border-border flex items-center gap-2">
            <Eye size={18} color={t.gold} strokeWidth={1.5} /> Booking Summary
          </h3>
          <div className="grid gap-3.5">
            <div className="flex justify-between items-center">
              <span className="text-text-muted text-sm flex items-center gap-1.5"><Calendar size={14} /> Date</span>
              <span className="font-bold text-sm">{selectedDay ? selectedDay.label : "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted text-sm flex items-center gap-1.5"><Clock size={14} /> Time</span>
              <span className="font-bold text-sm">{selectedTime || "—"}</span>
            </div>
            <div className="border-t border-border pt-3.5">
              <span className="text-text-muted text-sm flex items-center gap-1.5 mb-3"><Scissors size={14} /> Services</span>
              {isCustom ? (
                <div>
                  <div className={`flex gap-3 items-start ${(customStyleDescription || styleReferenceUrls.length > 0) ? "mb-2.5" : "mb-0"}`}>
                    {customStyleUrl && (
                      <img
                        src={customStyleUrl} alt="Requested style"
                        className="w-14 h-14 rounded-lg object-cover border border-border shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <span className="text-[11px] text-gold bg-gold-bg py-[3px] px-2.5 rounded-xl font-semibold border border-[#C49A6C30] inline-flex items-center gap-1">
                        <Image size={11} /> Custom Style (quote pending)
                      </span>
                      <p className="text-xs text-text-muted mt-1.5">Nessy will review and send you a price within 24 hours</p>
                    </div>
                  </div>
                  {styleReferenceUrls.length > 0 && (
                    <div className={`flex flex-wrap gap-1.5 ${customStyleUrl ? "pl-[68px]" : ""} ${customStyleDescription ? "mb-2.5" : "mb-0"}`}>
                      {styleReferenceUrls.map(url => (
                        <a
                          key={url} href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-gold bg-gold-bg py-1 px-2 rounded-lg border border-[#C49A6C30]"
                        >{labelForUrl(url)} <ExternalLink size={10} /></a>
                      ))}
                    </div>
                  )}
                  {customStyleDescription && (
                    <p className={`text-[13px] text-text-soft italic ${customStyleUrl ? "pl-[68px]" : ""}`}>"{customStyleDescription}"</p>
                  )}
                </div>
              ) : uploadMode && selectedServices.length === 0 ? (
                <div className="bg-gold-bg p-3 rounded-lg text-[13px] text-gold flex items-center gap-2">
                  <Image size={16} /> Custom style photo uploaded — quote pending
                </div>
              ) : selectedServices.map(name => {
                const s = allServices.find(x => x.name === name);
                return (
                  <div key={name} className="flex justify-between mb-2">
                    <span className="text-sm">{name}</span>
                    <span className={`text-sm font-semibold ${s?.price ? "text-text" : "text-gold"}`}>{s?.price || "Pending"}</span>
                  </div>
                );
              })}
            </div>

            {attachmentPreference && (
              <div className="border-t border-border pt-3.5">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted text-sm flex items-center gap-1.5"><Package size={14} /> Hair Attachments</span>
                  <span className="font-bold text-sm">
                    {attachmentPreference === "client_provides" ? "I'll bring my own" : "Nessy will purchase"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact details */}
        <div className="bg-surface rounded-2xl p-7 mb-5 border border-border">
          <h3 className="text-base font-bold mb-4">Your details</h3>
          <div className="grid gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1.5 font-medium">Full Name</label>
              <input
                value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your name"
                className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-sm text-text outline-none box-border"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5 font-medium">Phone Number</label>
              <input
                value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="080..."
                className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-sm text-text outline-none box-border"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5 font-medium">Email (optional)</label>
              <input
                type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="you@example.com"
                className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-sm text-text outline-none box-border"
              />
            </div>
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-xs text-text-muted font-medium">Additional notes for Nessy (optional)</label>
                <span className="text-[11px] text-text-muted">{clientNotes.length}/{MAX_NOTES_LENGTH}</span>
              </div>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
                placeholder="E.g., I'd also like a style done after my treatment, any preferences, allergies, etc."
                rows={3}
                className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-sm text-text outline-none box-border [font-family:inherit] resize-y"
              />
            </div>
          </div>
        </div>

        {submitError && <ErrorNotice message={submitError} />}

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 bg-surface text-text border border-border py-3 text-sm font-semibold cursor-pointer rounded-md flex items-center justify-center gap-1.5"
          ><ChevronLeft size={16} /> Back</button>
          <GoldButton
            onClick={handleConfirm} disabled={submitting}
            className={`flex-[2] bg-gold text-theme-black border-none p-3.5 text-[15px] font-bold rounded-md flex items-center justify-center gap-2 ${submitting ? "cursor-wait" : "cursor-pointer"}`}
          >
            {submitting ? <GoldSpinner size={18} color="#0A0A0A" /> : <Check size={18} />} {submitting ? "Submitting…" : "Submit Booking Request"}
          </GoldButton>
        </div>
      </div>
    </FadeIn>
  );
}
