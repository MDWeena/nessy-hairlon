import { Shield, Heart, Sparkles } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { FadeIn } from "../ui/FadeIn";

const ITEMS = [
  { icon: Shield, title: "Gentle on your hair", desc: "No tension, no breakage. Your edges stay intact." },
  { icon: Heart, title: "Natural hair focused", desc: "Products and techniques chosen for your texture." },
  { icon: Sparkles, title: "Styles that last", desc: "Protective styles that hold up for weeks." },
];

export function WhyNessy() {
  const { t } = useTheme();
  return (
    <section style={{ padding: "72px 24px", maxWidth: 800, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>WHY NESSY</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 20, lineHeight: 1.1 }}>
          People travel to her chair for a reason
        </h2>
      </FadeIn>
      <FadeIn delay={0.15}>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: t.textSoft, maxWidth: 560 }}>
          Natural hair isn't just a category — it's a craft. Every session starts with understanding your hair's unique texture, porosity, and needs before a single braid goes in. That's why clients come from across the city and beyond.
        </p>
      </FadeIn>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginTop: 40 }}>
        {ITEMS.map((item, i) => (
          <FadeIn key={item.title} delay={0.1 * (i + 1)}>
            <div className="hover-lift" style={{
              background: t.surface, borderRadius: 12, padding: 28,
              border: `1px solid ${t.border}`, cursor: "default",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: t.goldBg,
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
              }}>
                <item.icon size={20} color={t.gold} strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
