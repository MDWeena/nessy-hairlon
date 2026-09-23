import { Star, BadgeCheck } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useTestimonials } from "../../hooks/useTestimonials";
import type { NavigateFn } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

interface TestimonialsProps {
  navigate: NavigateFn;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatReviewMonth(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function Testimonials({ navigate }: TestimonialsProps) {
  const { t } = useTheme();
  const { testimonials, loading, error } = useTestimonials();
  const visible = testimonials.filter(story => story.visible);

  const average = visible.length > 0 ? visible.reduce((sum, s) => sum + s.stars, 0) / visible.length : 0;
  const distribution = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: visible.filter(s => s.stars === stars).length,
  }));

  return (
    <section style={{ padding: "72px 24px", maxWidth: 800, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>CLIENT STORIES</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 28 }}>
          The proof is in the braids
        </h2>
      </FadeIn>

      {error && <ErrorNotice message={error} />}
      {loading && <LoadingNotice label="Loading client stories…" />}

      {!loading && visible.length > 0 && (
        <FadeIn>
          <div style={{
            display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16,
            padding: "24px 28px", marginBottom: 32,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: t.text }}>{average.toFixed(1)}</div>
              <div style={{ display: "flex", gap: 2, marginTop: 6, justifyContent: "center" }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={14} fill={i < Math.round(average) ? t.gold : "transparent"} color={t.gold} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>from {visible.length} review{visible.length === 1 ? "" : "s"}</div>
            </div>
            <div style={{ flex: 1, minWidth: 160, display: "grid", gap: 4 }}>
              {distribution.map(({ stars, count }) => (
                <div key={stars} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: t.textMuted, width: 10 }}>{stars}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 4, background: t.border, overflow: "hidden" }}>
                    <div style={{
                      width: `${visible.length > 0 ? (count / visible.length) * 100 : 0}%`,
                      height: "100%", background: t.gold, borderRadius: 4,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {!loading && visible.map((review, i) => (
        <FadeIn key={review.id} delay={0.1 * (i + 1)}>
          <div style={{
            background: t.surface, padding: 28, borderRadius: 12, marginBottom: 16,
            borderLeft: `3px solid ${t.gold}`, border: `1px solid ${t.border}`,
            borderLeftWidth: 3, borderLeftColor: t.gold,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 2 }}>
                {Array(review.stars).fill(0).map((_, j) => <Star key={j} size={14} fill={t.gold} color={t.gold} />)}
              </div>
              <span style={{ fontSize: 12, color: t.textMuted }}>{formatReviewMonth(review.reviewDate)}</span>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: t.textSoft, fontStyle: "italic", marginBottom: 16 }}>
              "{review.text}"
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{review.name}</span>
              {review.verified && (
                <span style={{ fontSize: 11, color: t.gold, display: "flex", alignItems: "center", gap: 2 }}>
                  <BadgeCheck size={12} /> Verified
                </span>
              )}
            </div>
          </div>
        </FadeIn>
      ))}

      {!loading && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button onClick={() => navigate("review")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: t.gold, fontSize: 13, fontWeight: 600,
          }}>Leave a Review</button>
        </div>
      )}
    </section>
  );
}
