import { Eye, Calendar, Clock, Scissors, Image, DollarSign, ChevronLeft, Check } from "lucide-react";
import { services } from "../../constants/services";
import { useTheme } from "../../context/ThemeContext";
import type { BookingDay } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { GoldButton } from "../ui/GoldButton";

interface StepReviewProps {
  selectedDay: BookingDay | null;
  selectedTime: string | null;
  selectedServices: string[];
  uploadMode: boolean;
  onBack: () => void;
}

const allSvc = services.flatMap(s => s.items);

export function StepReview({ selectedDay, selectedTime, selectedServices, uploadMode, onBack }: StepReviewProps) {
  const { t } = useTheme();

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
              {uploadMode && selectedServices.length === 0 ? (
                <div style={{ background: t.goldBg, padding: 12, borderRadius: 8, fontSize: 13, color: t.gold, display: "flex", alignItems: "center", gap: 8 }}>
                  <Image size={16} /> Custom style photo uploaded — quote pending
                </div>
              ) : selectedServices.map(name => {
                const s = allSvc.find(x => x.name === name);
                return (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: s?.price ? t.text : t.gold }}>{s?.price || "Pending"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ background: t.goldBg, borderRadius: 16, padding: 24, marginBottom: 20, border: `1px solid ${t.goldLight}` }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
            <DollarSign size={16} color={t.gold} /> Payment details
          </h4>
          <p style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.6, marginBottom: 12 }}>
            A 50% deposit is required to confirm. Transfer to the account below and tap "I've paid" to notify Nessy.
          </p>
          <div style={{ background: t.surface, padding: 16, borderRadius: 10, fontSize: 14, lineHeight: 1.8, border: `1px solid ${t.border}` }}>
            <div><span style={{ color: t.textMuted }}>Bank:</span> <strong>GTBank</strong></div>
            <div><span style={{ color: t.textMuted }}>Account:</span> <strong>012 345 6789</strong></div>
            <div><span style={{ color: t.textMuted }}>Name:</span> <strong>Nessy Hairlon</strong></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onBack} style={{
            flex: 1, background: t.surface, color: t.text, border: `1px solid ${t.border}`,
            padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><ChevronLeft size={16} /> Back</button>
          <GoldButton style={{
            flex: 2, background: t.gold, color: "#0A0A0A", border: "none",
            padding: "14px", fontSize: 15, fontWeight: 700,
            cursor: "pointer", borderRadius: 6, display: "flex",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Check size={18} /> Confirm Booking
          </GoldButton>
        </div>
      </div>
    </FadeIn>
  );
}
