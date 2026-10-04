import { useState } from "react";
import { Search, Star, Check } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { lookupBookings, submitReview } from "../hooks/useBookingLookup";
import type { TrackedBooking } from "../hooks/useBookingLookup";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { GoldSpinner } from "../components/ui/GoldSpinner";

export function LeaveReviewPage() {
  const { t } = useTheme();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [booking, setBooking] = useState<TrackedBooking | null | undefined>(undefined);

  const [phone, setPhone] = useState("");
  const [stars, setStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) { setLookupError("Enter your booking reference or phone number"); return; }
    setLoading(true);
    setLookupError(null);
    setBooking(undefined);
    try {
      const looksLikeReference = /[a-z]/i.test(trimmed);
      const found = await lookupBookings(looksLikeReference ? { reference: trimmed } : { phone: trimmed });
      if (found.length === 0) {
        setLookupError("No booking found for that reference or phone number.");
        setBooking(null);
      } else {
        setBooking(found[0]);
        setPhone(!looksLikeReference ? trimmed : "");
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!booking) return;
    if (!phone.trim()) { setSubmitError("Confirm the phone number you booked with"); return; }
    if (!reviewText.trim()) { setSubmitError("Please write a short review"); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReview(booking.reference, phone.trim(), stars, reviewText.trim());
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-12 px-6 pb-[72px] max-w-[560px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">LEAVE A REVIEW</p>
        <h2 className="font-cursive text-5xl font-bold mb-3">
          How was your visit?
        </h2>
        {!submitted && (
          <p className="text-[15px] text-text-soft mb-8 leading-[1.6]">
            Find your completed appointment to leave a review.
          </p>
        )}
      </FadeIn>

      {submitted ? (
        <div className="bg-surface rounded-2xl p-10 text-center border border-border">
          <div className="w-14 h-14 rounded-full bg-gold-bg flex items-center justify-center mx-auto mt-0 mb-4">
            <Check size={26} color={t.gold} />
          </div>
          <h3 className="text-xl font-bold mb-2">Thank you!</h3>
          <p className="text-sm text-text-soft leading-[1.6]">
            Your review will appear on our site once approved.
          </p>
        </div>
      ) : booking === undefined || booking === null ? (
        <>
          <div className="flex gap-2 mb-5">
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. BK-A3BF7FC4 or 080..."
              className="flex-1 py-3 px-3.5 rounded-[10px] border border-border bg-bg-alt text-sm text-text outline-none box-border"
            />
            <GoldButton
              onClick={handleSearch} disabled={loading}
              className={`bg-gold text-theme-black border-none py-0 px-5 rounded-[10px] text-sm font-bold flex items-center gap-2 ${loading ? "cursor-wait" : "cursor-pointer"}`}
            >
              {loading ? <GoldSpinner size={16} color="#0A0A0A" /> : <Search size={16} />} {loading ? "Searching…" : "Search"}
            </GoldButton>
          </div>
          {lookupError && <ErrorNotice message={lookupError} />}
        </>
      ) : booking.status !== "completed" ? (
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <p className="text-sm text-text-soft leading-[1.6]">
            This appointment hasn't been marked complete yet, so it can't be reviewed. Check back after your visit.
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl p-7 border border-border">
          <div className="mb-5 pb-4 border-b border-border">
            <span className="text-[13px] font-bold text-gold">{booking.reference}</span>
            <p className="text-sm font-semibold mt-1.5">{booking.clientName}</p>
            <p className="text-[13px] text-text-muted mt-0.5">
              {booking.date} · {booking.serviceNames.length > 0 ? booking.serviceNames.join(", ") : "Custom style"}
            </p>
          </div>

          {submitError && <ErrorNotice message={submitError} />}

          <div className="mb-4">
            <label className="block text-xs text-text-muted mb-1.5 font-medium">
              Confirm the phone number you booked with
            </label>
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="080..."
              className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-text-muted mb-2 font-medium">Rating</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setStars(n)} className="bg-transparent border-none cursor-pointer p-0">
                  <Star size={28} fill={n <= stars ? t.gold : "transparent"} color={n <= stars ? t.gold : t.border} />
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs text-text-muted mb-1.5 font-medium">Your review</label>
            <textarea
              value={reviewText} onChange={(e) => setReviewText(e.target.value)}
              placeholder="Tell us about your experience…" rows={4}
              className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border [font-family:inherit] resize-y"
            />
          </div>

          <GoldButton
            onClick={handleSubmit} disabled={submitting}
            className={`w-full bg-gold text-theme-black border-none p-3.5 text-[15px] font-bold rounded-md flex items-center justify-center gap-2 ${submitting ? "cursor-wait" : "cursor-pointer"}`}
          >{submitting && <GoldSpinner size={16} color="#0A0A0A" />} {submitting ? "Submitting…" : "Submit Review"}</GoldButton>
        </div>
      )}
    </section>
  );
}
