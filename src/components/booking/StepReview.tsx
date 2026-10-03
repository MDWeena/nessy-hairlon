import { useState } from "react";
import { Eye, Calendar, Clock, Scissors, Image, ChevronLeft, ChevronRight, Check, Mail, MessageCircle, Package } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { createBooking } from "../../hooks/useBookings";
import { useSettings } from "../../hooks/useSettings";
import { shortBookingReference } from "../../lib/bookingReference";
import { buildWhatsAppUrl } from "../../lib/whatsapp";
import type { AttachmentPreference, BookingDay, NavigateFn, ServiceItem } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { GoldButton } from "../ui/GoldButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";

interface StepReviewProps {
  allServices: ServiceItem[];
  selectedDay: BookingDay | null;
  selectedTime: string | null;
  selectedServices: string[];
  uploadMode: boolean;
  customStyleUrl: string | null;
  customStyleDescription: string;
  attachmentPreference: AttachmentPreference | null;
  onBack: () => void;
  navigate: NavigateFn;
}

export function StepReview({
  allServices, selectedDay, selectedTime, selectedServices, uploadMode,
  customStyleUrl, customStyleDescription, attachmentPreference, onBack, navigate,
}: StepReviewProps) {
  const { t } = useTheme();
  const { settings } = useSettings();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const isCustom = !!customStyleUrl;

  const handleConfirm = async () => {
    if (!selectedDay || !selectedTime) return;
    setSubmitError(null);
    if (!clientName.trim() || !clientPhone.trim()) {
      setSubmitError("Please enter your name and phone number");
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
        <div style={{ background: t.surface, borderRadius: 16, padding: 40, border: `1px solid ${t.border}` }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: t.goldBg,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <Check size={26} color={t.gold} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Booking Request Submitted!</h3>
            <p style={{ fontSize: 14, color: t.textSoft, lineHeight: 1.6 }}>
              Thanks {clientName.trim()}! Your booking request has been received. Nessy will review it and send you a price quote within 24 hours.
            </p>
          </div>

          <div style={{
            background: t.goldBg, border: `1px solid ${t.gold}30`, borderRadius: 10,
            padding: "12px 16px", fontSize: 13, color: t.textSoft, textAlign: "center", marginBottom: 20,
          }}>
            Your reference: <strong style={{ color: t.gold }}>{reference}</strong>
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: t.textMuted, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={13} /> Date</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedDay ? selectedDay.label : "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: t.textMuted, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Clock size={13} /> Time</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedTime || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: t.textMuted, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Scissors size={13} /> Service</span>
              <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>
                {isCustom ? "Custom style (quote pending)" : selectedServices.join(", ") || "—"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, fontSize: 13, color: t.textSoft, marginBottom: 24 }}>
            {clientEmail.trim() && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={14} color={t.gold} /> You'll receive an email at <strong style={{ color: t.text }}>{clientEmail.trim()}</strong> when your quote is ready.
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageCircle size={14} color={t.gold} /> Questions? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" style={{ color: t.gold, fontWeight: 600 }}>WhatsApp Nessy directly</a>
            </div>
          </div>

          <button onClick={() => navigate("track")} style={{
            width: "100%", background: t.gold, color: "#0A0A0A", border: "none",
            padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>Track your booking status <ChevronRight size={16} /></button>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <div>
        <div style={{ background: t.surface, borderRadius: 16, padding: 28, marginBottom: 20, border: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Eye size={18} color={t.gold} strokeWidth={1.5} /> Booking Summary
          </h3>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: t.textMuted, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={14} /> Date</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedDay ? selectedDay.label : "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: t.textMuted, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} /> Time</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedTime || "—"}</span>
            </div>
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
              <span style={{ color: t.textMuted, fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}><Scissors size={14} /> Services</span>
              {isCustom ? (
                <div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: customStyleDescription ? 10 : 0 }}>
                    <img src={customStyleUrl ?? undefined} alt="Requested style" style={{
                      width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: `1px solid ${t.border}`, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontSize: 11, color: t.gold, background: t.goldBg,
                        padding: "3px 10px", borderRadius: 12, fontWeight: 600,
                        border: `1px solid ${t.gold}30`, display: "inline-flex", alignItems: "center", gap: 4,
                      }}><Image size={11} /> Custom Style (quote pending)</span>
                      <p style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>Nessy will review and send you a price within 24 hours</p>
                    </div>
                  </div>
                  {customStyleDescription && (
                    <p style={{ fontSize: 13, color: t.textSoft, fontStyle: "italic", paddingLeft: 68 }}>"{customStyleDescription}"</p>
                  )}
                </div>
              ) : uploadMode && selectedServices.length === 0 ? (
                <div style={{ background: t.goldBg, padding: 12, borderRadius: 8, fontSize: 13, color: t.gold, display: "flex", alignItems: "center", gap: 8 }}>
                  <Image size={16} /> Custom style photo uploaded — quote pending
                </div>
              ) : selectedServices.map(name => {
                const s = allServices.find(x => x.name === name);
                return (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: s?.price ? t.text : t.gold }}>{s?.price || "Pending"}</span>
                  </div>
                );
              })}
            </div>

            {attachmentPreference && (
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: t.textMuted, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Package size={14} /> Hair Attachments</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {attachmentPreference === "client_provides" ? "I'll bring my own" : "Nessy will purchase"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact details */}
        <div style={{ background: t.surface, borderRadius: 16, padding: 28, marginBottom: 20, border: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Your details</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>Full Name</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your name" style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                background: t.bgAlt, fontSize: 14, color: t.text, outline: "none", boxSizing: "border-box",
              }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>Phone Number</label>
              <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="080..." style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                background: t.bgAlt, fontSize: 14, color: t.text, outline: "none", boxSizing: "border-box",
              }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>Email (optional)</label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="you@example.com" style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                background: t.bgAlt, fontSize: 14, color: t.text, outline: "none", boxSizing: "border-box",
              }} />
            </div>
          </div>
        </div>

        {submitError && <ErrorNotice message={submitError} />}

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onBack} style={{
            flex: 1, background: t.surface, color: t.text, border: `1px solid ${t.border}`,
            padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><ChevronLeft size={16} /> Back</button>
          <GoldButton onClick={handleConfirm} disabled={submitting} style={{
            flex: 2, background: t.gold, color: "#0A0A0A", border: "none",
            padding: "14px", fontSize: 15, fontWeight: 700,
            cursor: submitting ? "wait" : "pointer", borderRadius: 6, display: "flex",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {submitting ? <GoldSpinner size={18} color="#0A0A0A" /> : <Check size={18} />} {submitting ? "Submitting…" : "Submit Booking Request"}
          </GoldButton>
        </div>
      </div>
    </FadeIn>
  );
}
