import { Star } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { FadeIn } from "../ui/FadeIn";

const REVIEWS = [
  { name: "Amara O.", text: "I drove 3 hours to get my locs done. Worth every minute. She understands natural hair like no one else.", stars: 5 },
  { name: "Chidinma E.", text: "My braids lasted 8 weeks and my scalp felt amazing the entire time. The treatments are top tier.", stars: 5 },
  { name: "Bola A.", text: "Finally found someone who treats natural hair with the care it deserves. I won't go anywhere else.", stars: 5 },
];

export function Testimonials() {
  const { t } = useTheme();
  return (
    <section style={{ padding: "72px 24px", maxWidth: 800, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>CLIENT STORIES</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 40 }}>
          The proof is in the braids
        </h2>
      </FadeIn>
      {REVIEWS.map((review, i) => (
        <FadeIn key={i} delay={0.1 * (i + 1)}>
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
