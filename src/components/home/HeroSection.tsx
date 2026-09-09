import { ArrowRight } from "lucide-react";
import { HERO_BG, LOGO_WHITE_TEXT } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";
import type { NavigateFn } from "../../types";
import { GoldButton } from "../ui/GoldButton";
import { OutlineButton } from "../ui/OutlineButton";

interface HeroSectionProps {
  navigate: NavigateFn;
}

export function HeroSection({ navigate }: HeroSectionProps) {
  const { t, isDark } = useTheme();

  return (
    <section style={{
      position: "relative", minHeight: 520, display: "flex", alignItems: "center",
      justifyContent: "center", textAlign: "center", overflow: "hidden",
      background: `url(${HERO_BG}) center/cover no-repeat`,
    }}>
      {/* Dark overlay over the background image */}
      <div style={{
        position: "absolute", inset: 0,
        background: isDark
          ? "linear-gradient(135deg, rgba(10,10,6,0.92) 0%, rgba(42,26,14,0.85) 100%)"
          : "linear-gradient(135deg, rgba(10,10,6,0.88) 0%, rgba(42,26,14,0.78) 100%)",
        zIndex: 1,
      }} />
      {/* Animated gold circle decoration */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 500, height: 500, borderRadius: "50%",
        border: `1px solid ${t.gold}20`,
        animation: "pulse 4s ease-in-out infinite", zIndex: 2,
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 380, height: 380, borderRadius: "50%",
        border: `1px solid ${t.gold}15`,
        animation: "pulse 4s ease-in-out infinite 0.5s", zIndex: 2,
      }} />

      <style>{`
        .gold-line { height: 2px; background: linear-gradient(90deg, transparent, ${t.gold}, transparent); animation: shimmer 3s ease infinite; background-size: 200px 100%; }
      `}</style>

      <div style={{ position: "relative", zIndex: 3, padding: isDark ? "120px 24px 80px" : "80px 24px 80px", maxWidth: 640, animation: "slideUp 0.8s ease forwards" }}>
        {/* Logo mark */}
        <img src={LOGO_WHITE_TEXT} alt="Nessy Hairlon" style={{
          width: 220, margin: "0 auto 12px", display: "block",
          filter: "drop-shadow(0 0 30px rgba(196,154,108,0.3))",
        }} />

        <p style={{ color: t.gold, fontSize: 12, letterSpacing: 4, fontWeight: 500, marginBottom: 20 }}>
          NATURAL HAIR SPECIALIST
        </p>

        <h1 style={{
          fontFamily: "'Tangerine', cursive", fontSize: "clamp(36px, 6vw, 52px)",
          fontWeight: 700, color: "#fff", lineHeight: 1, margin: "0 0 12px",
          opacity: 0,
          height: 0,
        }}>
          Nessy Hairlon
        </h1>

        <div className="gold-line" style={{ width: 120, margin: "0 auto 24px" }} />

        <p style={{ fontSize: 16, color: "#bbb", lineHeight: 1.7, maxWidth: 440, margin: "0 auto 36px" }}>
          Braiding, locs, treatments & styling by someone who understands your hair from root to tip. People travel for this.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <GoldButton onClick={() => navigate("book")} style={{
            background: t.gold, color: "#0A0A0A", border: "none",
            padding: "14px 36px", fontSize: 14, fontWeight: 700,
            cursor: "pointer", borderRadius: 6, display: "flex",
            alignItems: "center", gap: 8,
          }}>
            Book an Appointment <ArrowRight size={16} />
          </GoldButton>
          <OutlineButton onClick={() => navigate("services")} style={{
            background: "transparent", color: "#ccc",
            border: `1px solid #555`, padding: "14px 28px",
            fontSize: 14, fontWeight: 500, cursor: "pointer", borderRadius: 6,
          }}>
            View Services
          </OutlineButton>
        </div>
      </div>
    </section>
  );
}
