import { Star } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useTestimonials } from "../../hooks/useTestimonials";
import { FadeIn } from "../ui/FadeIn";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

export function Testimonials() {
  const { t } = useTheme();
  const { testimonials, loading, error } = useTestimonials();
  const visible = testimonials.filter(story => story.visible);

  return (
    <section style={{ padding: "72px 24px", maxWidth: 800, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>CLIENT STORIES</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 40 }}>
          The proof is in the braids
        </h2>
      </FadeIn>

      {error && <ErrorNotice message={error} />}
      {loading && <LoadingNotice label="Loading client stories…" />}

      {!loading && visible.map((review, i) => (
        <FadeIn key={review.id} delay={0.1 * (i + 1)}>
          <div style={{
            background: t.surface, padding: 28, borderRadius: 12, marginBottom: 16,
            borderLeft: `3px solid ${t.gold}`, border: `1px solid ${t.border}`,
            borderLeftWidth: 3, borderLeftColor: t.gold,
          }}>
            <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
              {Array(review.stars).fill(0).map((_, j) => <Star key={j} size={14} fill={t.gold} color={t.gold} />)}
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: t.textSoft, fontStyle: "italic", marginBottom: 16 }}>
              "{review.text}"
            </p>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{review.name}</span>
          </div>
        </FadeIn>
      ))}
    </section>
  );
}
