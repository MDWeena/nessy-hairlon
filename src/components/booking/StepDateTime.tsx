import { Calendar, Clock, ChevronRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { BookingDay } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { GoldButton } from "../ui/GoldButton";

interface StepDateTimeProps {
  bookingDays: BookingDay[];
  selectedDayIdx: number | null;
  onSelectDay: (idx: number) => void;
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  onContinue: () => void;
}

export function StepDateTime({ bookingDays, selectedDayIdx, onSelectDay, selectedTime, onSelectTime, onContinue }: StepDateTimeProps) {
  const { t } = useTheme();
  const selectedDay = selectedDayIdx !== null ? bookingDays[selectedDayIdx] : null;

  return (
    <FadeIn>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={18} color={t.gold} strokeWidth={1.5} /> Pick a day
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 32 }}>
          {bookingDays.map((day, i) => (
            <button key={i} onClick={() => onSelectDay(i)} className="hover-lift" style={{
              padding: "14px 8px", borderRadius: 10, cursor: "pointer",
              border: selectedDayIdx === i ? `2px solid ${t.gold}` : `1px solid ${t.border}`,
              background: selectedDayIdx === i ? t.goldBg : t.surface,
              color: t.text, fontWeight: selectedDayIdx === i ? 700 : 400,
              fontSize: 13, textAlign: "center", transition: "all 0.2s ease",
            }}>
              <div style={{ fontWeight: 600 }}>{day.label}</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{day.slotCount} slots available</div>
            </button>
          ))}
        </div>

        {selectedDay && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={18} color={t.gold} strokeWidth={1.5} /> Choose a time
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 32 }}>
              {selectedDay.slots.map(time => (
                <button key={time} onClick={() => onSelectTime(time)} style={{
                  padding: "12px 8px", borderRadius: 8, cursor: "pointer",
                  border: selectedTime === time ? `2px solid ${t.gold}` : `1px solid ${t.border}`,
                  background: selectedTime === time ? t.goldBg : t.surface,
                  fontWeight: selectedTime === time ? 700 : 400,
                  fontSize: 14, color: t.text, transition: "all 0.2s",
                }}>{time}</button>
              ))}
            </div>
          </>
        )}

        {selectedDay && selectedTime && (
          <GoldButton onClick={onContinue} style={{
            background: t.gold, color: "#0A0A0A", border: "none",
            padding: "14px 0", fontSize: 14, fontWeight: 700,
            cursor: "pointer", borderRadius: 6, width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            Continue <ChevronRight size={16} />
          </GoldButton>
        )}
      </div>
    </FadeIn>
  );
}
