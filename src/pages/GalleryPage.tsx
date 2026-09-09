import { Scissors, ArrowRight, Upload } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import type { NavigateFn } from "../types";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";

interface GalleryPageProps {
  navigate: NavigateFn;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STYLE_NAMES = [
  "Goddess Locs", "Knotless Braids", "Fulani Braids", "Passion Twists",
  "Feed-in Cornrows", "Butterfly Locs", "Bohemian Twists",
];

export function GalleryPage({ navigate }: GalleryPageProps) {
  const { t, isDark } = useTheme();

  return (
    <section style={{ padding: "48px 24px 72px", maxWidth: 900, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>GALLERY</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 8 }}>Styles of the week</h2>
        <p style={{ fontSize: 15, color: t.textSoft, marginBottom: 40, maxWidth: 500, lineHeight: 1.6 }}>
          Seven looks for seven days. Browse the week's featured styles and book the one that speaks to you.
        </p>
      </FadeIn>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {DAYS_OF_WEEK.map((day, i) => (
          <FadeIn key={day} delay={0.06 * (i + 1)}>
            <div className="hover-lift" style={{
              background: t.surface, borderRadius: 16, overflow: "hidden",
              border: `1px solid ${t.border}`, cursor: "pointer",
            }}>
              {/* Placeholder image area */}
              <div style={{
                height: 200, background: `linear-gradient(135deg, ${t.gold}20, ${t.gold}08)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}15)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Scissors size={28} color={t.gold} strokeWidth={1} />
                </div>
                {/* Day badge */}
                <div style={{
                  position: "absolute", top: 12, left: 12,
                  background: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(8px)", borderRadius: 20,
                  padding: "4px 14px", fontSize: 11, fontWeight: 600, color: t.gold,
                  border: `1px solid ${t.gold}30`,
                }}>{day}</div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{STYLE_NAMES[i]}</h3>
                <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>Featured style for {day}</p>
                <button onClick={() => navigate("book")} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: t.gold, fontSize: 13, fontWeight: 600, padding: 0,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  Book this style <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* CTA */}
      <FadeIn delay={0.5}>
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <p style={{ fontSize: 15, color: t.textSoft, marginBottom: 20 }}>Don't see your style? Upload a picture and get a custom quote.</p>
          <GoldButton onClick={() => navigate("book")} style={{
            background: t.gold, color: "#0A0A0A", border: "none",
            padding: "14px 36px", fontSize: 14, fontWeight: 700,
            cursor: "pointer", borderRadius: 6, display: "inline-flex",
            alignItems: "center", gap: 8,
          }}>Book with Custom Style <Upload size={16} /></GoldButton>
        </div>
      </FadeIn>
    </section>
  );
}
