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
    <section className="py-[72px] px-6 max-w-[800px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">CLIENT STORIES</p>
        <h2 className="font-cursive text-5xl font-bold mb-7">
          The proof is in the braids
        </h2>
      </FadeIn>

      {error && <ErrorNotice message={error} />}
      {loading && <LoadingNotice label="Loading client stories…" />}

      {!loading && visible.length > 0 && (
        <FadeIn>
          <div className="flex items-center gap-7 flex-wrap bg-surface border border-border rounded-2xl py-6 px-7 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold leading-none text-text">{average.toFixed(1)}</div>
              <div className="flex gap-0.5 mt-1.5 justify-center">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={14} fill={i < Math.round(average) ? t.gold : "transparent"} color={t.gold} />
                ))}
              </div>
              <div className="text-xs text-text-muted mt-1.5">from {visible.length} review{visible.length === 1 ? "" : "s"}</div>
            </div>
            <div className="flex-1 min-w-[160px] grid gap-1">
              {distribution.map(({ stars, count }) => (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted w-2.5">{stars}</span>
                  <div className="flex-1 h-1.5 rounded bg-border overflow-hidden">
                    <div
                      className="h-full bg-gold rounded"
                      style={{ width: `${visible.length > 0 ? (count / visible.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {!loading && visible.map((review, i) => (
        <FadeIn key={review.id} delay={0.1 * (i + 1)}>
          <div className="bg-surface p-7 rounded-xl mb-4 border border-border border-l-[3px] border-l-gold">
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-0.5">
                {Array(review.stars).fill(0).map((_, j) => <Star key={j} size={14} fill={t.gold} color={t.gold} />)}
              </div>
              <span className="text-xs text-text-muted">{formatReviewMonth(review.reviewDate)}</span>
            </div>
            <p className="text-[15px] leading-[1.7] text-text-soft italic mb-4">
              "{review.text}"
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-text">{review.name}</span>
              {review.verified && (
                <span className="text-[11px] text-gold flex items-center gap-0.5">
                  <BadgeCheck size={12} /> Verified
                </span>
              )}
            </div>
          </div>
        </FadeIn>
      ))}

      {!loading && (
        <div className="text-center mt-6">
          <button onClick={() => navigate("review")} className="bg-transparent border-none cursor-pointer text-gold text-[13px] font-semibold">
            Leave a Review
          </button>
        </div>
      )}
    </section>
  );
}
