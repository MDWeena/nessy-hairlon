import { useState } from "react";
import { Search, Star, Check } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { lookupBookings, submitReview } from "../hooks/useBookingLookup";
import type { TrackedBooking } from "../hooks/useBookingLookup";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";
import { ErrorNotice } from "../components/ui/ErrorNotice";

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
    <section style={{ padding: "48px 24px 72px", maxWidth: 560, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>LEAVE A REVIEW</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 12 }}>
          How was your visit?
        </h2>
        {!submitted && (
          <p style={{ fontSize: 15, color: t.textSoft, marginBottom: 32, lineHeight: 1.6 }}>
            Find your completed appointment to leave a review.
          </p>
        )}
      </FadeIn>

      {submitted ? (
        <div style={{ background: t.surface, borderRadius: 16, padding: 40, textAlign: "center", border: `1px solid ${t.border}` }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", background: t.goldBg,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <Check size={26} color={t.gold} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Thank you!</h3>
          <p style={{ fontSize: 14, color: t.textSoft, lineHeight: 1.6 }}>
            Your review will appear on our site once approved.
          </p>
        </div>
      ) : booking === undefined || booking === null ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. BK-A3BF7FC4 or 080..."
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.border}`,
                background: t.bgAlt, fontSize: 14, color: t.text, outline: "none", boxSizing: "border-box",
              }}
            />
            <GoldButton onClick={handleSearch} disabled={loading} style={{
              background: t.gold, color: "#0A0A0A", border: "none",
              padding: "0 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
            }}>
              <Search size={16} /> {loading ? "Searching…" : "Search"}
            </GoldButton>
          </div>
          {lookupError && <ErrorNotice message={lookupError} />}
        </>
      ) : booking.status !== "completed" ? (
        <div style={{ background: t.surface, borderRadius: 16, padding: 24, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 14, color: t.textSoft, lineHeight: 1.6 }}>
            This appointment hasn't been marked complete yet, so it can't be reviewed. Check back after your visit.
          </p>
        </div>
      ) : (
        <div style={{ background: t.surface, borderRadius: 16, padding: 28, border: `1px solid ${t.border}` }}>
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.gold }}>{booking.reference}</span>
            <p style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{booking.clientName}</p>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>
              {booking.date} · {booking.serviceNames.length > 0 ? booking.serviceNames.join(", ") : "Custom style"}
            </p>
          </div>

          {submitError && <ErrorNotice message={submitError} />}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>
              Confirm the phone number you booked with
            </label>
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="080..." style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 8, fontWeight: 500 }}>Rating</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setStars(n)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <Star size={28} fill={n <= stars ? t.gold : "transparent"} color={n <= stars ? t.gold : t.border} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>Your review</label>
            <textarea
              value={reviewText} onChange={(e) => setReviewText(e.target.value)}
              placeholder="Tell us about your experience…" rows={4}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                fontFamily: "inherit", resize: "vertical",
              }}
            />
          </div>

          <GoldButton onClick={handleSubmit} disabled={submitting} style={{
            width: "100%", background: t.gold, color: "#0A0A0A", border: "none",
            padding: "14px", fontSize: 15, fontWeight: 700,
            cursor: submitting ? "wait" : "pointer", borderRadius: 6,
          }}>{submitting ? "Submitting…" : "Submit Review"}</GoldButton>
        </div>
      )}
    </section>
  );
}
