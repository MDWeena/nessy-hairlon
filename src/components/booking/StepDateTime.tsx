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
        <h3 className="text-base font-bold mb-5 flex items-center gap-2">
          <Calendar size={18} color={t.gold} strokeWidth={1.5} /> Pick a day
        </h3>
        <div className="day-picker-grid grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2 mb-8">
          {bookingDays.map((day, i) => (
            <button
              key={i} onClick={() => onSelectDay(i)}
              className={`hover-lift py-3.5 px-2 rounded-[10px] cursor-pointer text-text text-[13px] text-center [transition:all_0.2s_ease] ${
                selectedDayIdx === i ? "border-2 border-gold bg-gold-bg font-bold" : "border border-border bg-surface font-normal"
              }`}
            >
              <div className="font-semibold">{day.label}</div>
              <div className="text-[11px] text-text-muted mt-1">{day.slotCount} slots available</div>
            </button>
          ))}
        </div>

        {selectedDay && (
          <>
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Clock size={18} color={t.gold} strokeWidth={1.5} /> Choose a time
            </h3>
            <div className="time-slot-grid grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-2 mb-8">
              {selectedDay.slots.map(time => (
                <button
                  key={time} onClick={() => onSelectTime(time)}
                  className={`py-3 px-2 rounded-lg cursor-pointer text-sm text-text [transition:all_0.2s] ${
                    selectedTime === time ? "border-2 border-gold bg-gold-bg font-bold" : "border border-border bg-surface font-normal"
                  }`}
                >{time}</button>
              ))}
            </div>
          </>
        )}

        {selectedDay && selectedTime && (
          <GoldButton
            onClick={onContinue}
            className="bg-gold text-theme-black border-none py-3.5 px-0 text-sm font-bold cursor-pointer rounded-md w-full flex items-center justify-center gap-2"
          >
            Continue <ChevronRight size={16} />
          </GoldButton>
        )}
      </div>
    </FadeIn>
  );
}
