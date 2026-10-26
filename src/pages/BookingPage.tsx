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
import { EMPTY_CLIENT, clearBookingDraft, draftHasProgress, loadBookingDraft, saveBookingDraft, type BookingDraft } from "../lib/bookingDraft";
import { registerDraft } from "../lib/formDrafts";

interface BookingPageProps {
  navigate: NavigateFn;
  preselectedService?: string | null;
  onConsumePreselectedService?: () => void;
}

export function BookingPage({ navigate, preselectedService, onConsumePreselectedService }: BookingPageProps) {
  const { services, loading: servicesLoading, error: servicesError } = useServices();
  const { bookingDays, loading: availabilityLoading, error: availabilityError } = useAvailability();
  // A form saved just before a "Refresh and continue" (or an automatic reload onto a newer
  // build) is restored here, so the client doesn't retype anything.
  const [restored] = useState(() => loadBookingDraft());
  const [historyResolved, setHistoryResolved] = useState(!!restored);
  const [step, setStep] = useState(restored?.step ?? 0);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>(restored?.services ?? []);
  const [customStyleUrl, setCustomStyleUrl] = useState<string | null>(restored?.customStyleUrl ?? null);
  const [customStyleDescription, setCustomStyleDescription] = useState(restored?.customStyleDescription ?? "");
  const [styleReferenceUrls, setStyleReferenceUrls] = useState<string[]>(restored?.styleReferenceUrls ?? []);
  const [attachmentPreference, setAttachmentPreference] = useState<AttachmentPreference | null>(restored?.attachmentPreference ?? null);
  const clientRef = useRef<BookingDraft["client"]>(restored?.client ?? EMPTY_CLIENT);
  // Set once the booking succeeds: nothing left to save, and no reason to hold back a reload.
  const bookedRef = useRef(false);

  // Put the restored day/slot back once the calendar has loaded. Matched by date, not list
  // position; if that day or slot is no longer offered, the client picks again.
  const dayRestoredRef = useRef(false);
  useEffect(() => {
    if (dayRestoredRef.current || !restored || bookingDays.length === 0) return;
    dayRestoredRef.current = true;
    const idx = restored.dayDate ? bookingDays.findIndex(d => d.date === restored.dayDate) : -1;
    if (idx < 0) { if (restored.step > 0) setStep(0); return; }
    setSelectedDayIdx(idx);
    if (restored.time && bookingDays[idx].slots.includes(restored.time)) setSelectedTime(restored.time);
    else if (restored.step > 0) setStep(0);
  }, [restored, bookingDays]);

  // Keep the latest form state reachable for "save before reload" without re-registering.
  const currentDraft = (): Omit<BookingDraft, "savedAt"> => ({
    step, dayDate: selectedDayIdx !== null ? bookingDays[selectedDayIdx]?.date ?? null : restored?.dayDate ?? null,
    time: selectedTime, services: selectedServices, customStyleUrl, customStyleDescription, styleReferenceUrls,
    attachmentPreference, client: clientRef.current,
  });
  const draftRef = useRef(currentDraft);
  useEffect(() => { draftRef.current = currentDraft; });
  useEffect(() => registerDraft({
    // Only a form with something in it is worth restoring — an empty "draft" would skip the
    // "booked with us before?" step after the reload.
    save: () => { const d = draftRef.current(); if (!bookedRef.current && draftHasProgress(d)) saveBookingDraft(d); },
    inProgress: () => !bookedRef.current && draftHasProgress(draftRef.current()),
  }), []);
  const handleBooked = () => { bookedRef.current = true; clearBookingDraft(); };

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
  // Never show raw database text to clients; the detail is logged where it happened.
  const error = servicesError || availabilityError ? "We couldn't load the booking calendar. Please refresh the page and try again." : null;

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
              serviceCategories={services}
              selectedServices={selectedServices}
              onToggleService={toggleService}
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
              customStyleUrl={customStyleUrl}
              customStyleDescription={customStyleDescription}
              styleReferenceUrls={styleReferenceUrls}
              attachmentPreference={attachmentPreference}
              onBack={() => setStep(1)}
              navigate={navigate}
              initialClient={clientRef.current}
              onClientChange={(c) => { clientRef.current = c; }}
              onBooked={handleBooked}
            />
          )}
        </>
      )}
    </section>
  );
}
