import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useBookingDays } from "../hooks/useBookingDays";
import { FadeIn } from "../components/ui/FadeIn";
import { ProgressBar } from "../components/booking/ProgressBar";
import { StepDateTime } from "../components/booking/StepDateTime";
import { StepServices } from "../components/booking/StepServices";
import { StepReview } from "../components/booking/StepReview";

export function BookingPage() {
  const { t } = useTheme();
  const [step, setStep] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState(false);

  const bookingDays = useBookingDays();
  const selectedDay = selectedDayIdx !== null ? bookingDays[selectedDayIdx] : null;

  const toggleService = (name: string) => setSelectedServices(p => p.includes(name) ? p.filter(s => s !== name) : [...p, name]);

  const handleSelectDay = (idx: number) => {
    setSelectedDayIdx(idx);
    setSelectedTime(null);
  };

  return (
    <section style={{ padding: "48px 24px 72px", maxWidth: 680, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>BOOK APPOINTMENT</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 36 }}>
          Let's get you booked in
        </h2>
      </FadeIn>

      <ProgressBar step={step} />

      {step === 0 && (
        <StepDateTime
          bookingDays={bookingDays}
          selectedDayIdx={selectedDayIdx}
          onSelectDay={handleSelectDay}
          selectedTime={selectedTime}
          onSelectTime={setSelectedTime}
          onContinue={() => setStep(1)}
        />
      )}

      {step === 1 && (
        <StepServices
          selectedServices={selectedServices}
          onToggleService={toggleService}
          uploadMode={uploadMode}
          setUploadMode={setUploadMode}
          onBack={() => setStep(0)}
          onContinue={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepReview
          selectedDay={selectedDay}
          selectedTime={selectedTime}
          selectedServices={selectedServices}
          uploadMode={uploadMode}
          onBack={() => setStep(1)}
        />
      )}
    </section>
  );
}
