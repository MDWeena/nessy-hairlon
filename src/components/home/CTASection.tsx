import { ArrowRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { NavigateFn } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { GoldButton } from "../ui/GoldButton";

interface CTASectionProps {
  navigate: NavigateFn;
}

export function CTASection({ navigate }: CTASectionProps) {
  const { t, isDark } = useTheme();
  return (
    <FadeIn>
      <section style={{
        position: "relative", padding: "72px 24px", textAlign: "center", overflow: "hidden",
        background: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23C49A6C' fill-opacity='0.04'%3E%3Cpath d='M20 0L40 20L20 40L0 20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, ${isDark ? "#1A1207" : "#2A1A0E"}, ${isDark ? "#0A0806" : "#0A0A0A"})`,
      }}>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 52, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
          Ready to book?
        </h2>
        <p style={{ fontSize: 15, color: "#999", marginBottom: 32, maxWidth: 400, margin: "0 auto 32px" }}>
          Pick a date, choose your service, and let Nessy take care of the rest.
        </p>
        <GoldButton onClick={() => navigate("book")} style={{
          background: t.gold, color: "#0A0A0A", border: "none",
          padding: "14px 40px", fontSize: 15, fontWeight: 700,
          cursor: "pointer", borderRadius: 6, display: "inline-flex",
          alignItems: "center", gap: 8,
        }}>
          Book an Appointment <ArrowRight size={16} />
        </GoldButton>
      </section>
    </FadeIn>
  );
}
