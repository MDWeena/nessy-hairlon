import { useEffect, useRef, useState } from "react";
import { useServices } from "../hooks/useServices";
import { useAvailability } from "../hooks/useAvailability";
import { FadeIn } from "../components/ui/FadeIn";
import { LoadingNotice } from "../components/ui/LoadingNotice";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { ProgressBar } from "../components/booking/ProgressBar";
import { StepClientHistory } from "../components/booking/StepClientHistory";
import { StepDateTime } from "../components/booking/StepDateTime";
import { StepServices } from "../components/booking/StepServices";
import { StepReview } from "../components/booking/StepReview";
import type { AttachmentPreference, NavigateFn } from "../types";

interface BookingPageProps {
  navigate: NavigateFn;
  preselectedService?: string | null;
  onConsumePreselectedService?: () => void;
}

export function BookingPage({ navigate, preselectedService, onConsumePreselectedService }: BookingPageProps) {
  const { services, loading: servicesLoading, error: servicesError } = useServices();
  const { bookingDays, loading: availabilityLoading, error: availabilityError } = useAvailability();
  const [historyResolved, setHistoryResolved] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState(false);
  const [customStyleUrl, setCustomStyleUrl] = useState<string | null>(null);
  const [customStyleDescription, setCustomStyleDescription] = useState("");
  const [styleReferenceUrls, setStyleReferenceUrls] = useState<string[]>([]);
  const [attachmentPreference, setAttachmentPreference] = useState<AttachmentPreference | null>(null);

  const handleBookAgain = (serviceNames: string[]) => {
    setSelectedServices(serviceNames.filter(name => services.flatMap(c => c.items).some(s => s.name === name)));
    setHistoryResolved(true);
  };

  // Scroll to top on every step change within the wizard (and when leaving the "booked
  // before?" screen into it) — these are in-page view swaps with no URL change, so the
  // page-level navigation scroll-reset never runs for them.
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) { isFirstRenderRef.current = false; return; }
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [step, historyResolved]);

  // Arrived here via a "Book This Style/Service" CTA elsewhere on the site — pre-select
  // it, skip the "booked before?" step, and consume it so it doesn't linger on a later visit.
  useEffect(() => {
    if (!preselectedService || services.length === 0) return;
    const allNames = services.flatMap(c => c.items).map(s => s.name);
    if (allNames.includes(preselectedService)) {
      setSelectedServices([preselectedService]);
      setHistoryResolved(true);
    }
    onConsumePreselectedService?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedService, services]);

  const allServices = services.flatMap(c => c.items);
  const selectedDay = selectedDayIdx !== null ? bookingDays[selectedDayIdx] : null;

  const toggleService = (name: string) => setSelectedServices(p => p.includes(name) ? p.filter(s => s !== name) : [...p, name]);

  const handleSelectDay = (idx: number) => {
    setSelectedDayIdx(idx);
    setSelectedTime(null);
  };

  const loading = servicesLoading || availabilityLoading;
  const error = servicesError || availabilityError;

  return (
    <section className="pt-12 px-6 pb-[72px] max-w-[680px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">BOOK APPOINTMENT</p>
        <h2 className="font-cursive text-5xl font-bold mb-9">
          Let's get you booked in
        </h2>
      </FadeIn>

      {error && <ErrorNotice message={error} />}

      {loading ? (
        <LoadingNotice label="Loading booking options…" />
      ) : !historyResolved ? (
        <StepClientHistory
          navigate={navigate}
          onContinueFresh={() => setHistoryResolved(true)}
          onBookAgain={handleBookAgain}
        />
      ) : (
        <>
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
              allServices={allServices}
              selectedServices={selectedServices}
              onToggleService={toggleService}
              uploadMode={uploadMode}
              setUploadMode={setUploadMode}
              customStyleUrl={customStyleUrl}
              onPhotoUploaded={setCustomStyleUrl}
              onPhotoRemoved={() => setCustomStyleUrl(null)}
              customStyleDescription={customStyleDescription}
              onDescriptionChange={setCustomStyleDescription}
              styleReferenceUrls={styleReferenceUrls}
              onAddStyleReferenceUrl={(url) => setStyleReferenceUrls(p => [...p, url])}
              onRemoveStyleReferenceUrl={(url) => setStyleReferenceUrls(p => p.filter(u => u !== url))}
              attachmentPreference={attachmentPreference}
              onAttachmentPreferenceChange={setAttachmentPreference}
              onBack={() => setStep(0)}
              onContinue={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <StepReview
              allServices={allServices}
              selectedDay={selectedDay}
              selectedTime={selectedTime}
              selectedServices={selectedServices}
              uploadMode={uploadMode}
              customStyleUrl={customStyleUrl}
              customStyleDescription={customStyleDescription}
              styleReferenceUrls={styleReferenceUrls}
              attachmentPreference={attachmentPreference}
              onBack={() => setStep(1)}
              navigate={navigate}
            />
          )}
        </>
      )}
    </section>
  );
}
