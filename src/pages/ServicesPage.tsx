import { useState } from "react";
import { Clock, Image } from "lucide-react";
import { services } from "../constants/services";
import { useTheme } from "../context/ThemeContext";
import type { NavigateFn } from "../types";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";

interface ServicesPageProps {
  navigate: NavigateFn;
}

export function ServicesPage({ navigate }: ServicesPageProps) {
  const { t, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState(services[0].cat);

  return (
    <section style={{ padding: "48px 24px 72px", maxWidth: 800, margin: "0 auto" }}>
      <FadeIn>
        <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>OUR SERVICES</p>
        <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 8 }}>What we offer</h2>
        <p style={{ fontSize: 15, color: t.textSoft, marginBottom: 36, maxWidth: 500, lineHeight: 1.6 }}>
          Fixed-price treatments listed below. For braiding, locs, and custom styles — send a picture and get a personalised quote.
        </p>
      </FadeIn>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 32, background: t.bgAlt, borderRadius: 8, padding: 4, width: "fit-content" }}>
        {services.map(s => (
          <button key={s.cat} onClick={() => setActiveTab(s.cat)} style={{
            padding: "10px 24px", borderRadius: 6, border: "none", cursor: "pointer",
            background: activeTab === s.cat ? t.gold : "transparent",
            color: activeTab === s.cat ? "#0A0A0A" : t.textSoft,
            fontWeight: activeTab === s.cat ? 700 : 500, fontSize: 13,
            transition: "all 0.3s ease",
          }}>{s.cat}</button>
        ))}
      </div>

      {/* Service cards */}
      <div style={{ display: "grid", gap: 12 }}>
        {services.find(s => s.cat === activeTab)?.items.map((s, i) => (
          <FadeIn key={s.name} delay={0.05 * (i + 1)}>
            <div className="hover-lift" style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 24px", background: t.surface, borderRadius: 12,
              border: `1px solid ${t.border}`, cursor: "default",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: t.goldBg, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <s.icon size={18} color={t.gold} strokeWidth={1.5} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: t.textMuted }}>{s.desc}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, color: t.gold }}>
                    <Clock size={12} /> {s.duration}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right", marginLeft: 16, flexShrink: 0 }}>
                {s.price ? (
                  <span style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{s.price}</span>
                ) : (
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text, display: "block", marginBottom: 4 }}>{s.priceRange || ""}</span>
                    <span style={{
                      fontSize: 11, color: t.gold, background: t.goldBg,
                      padding: "3px 10px", borderRadius: 12, fontWeight: 600,
                      border: `1px solid ${t.gold}30`,
                    }}>Final price on request</span>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Custom style CTA */}
      <FadeIn delay={0.3}>
        <div style={{
          background: isDark ? "#1A1510" : t.black, borderRadius: 16, padding: 36,
          textAlign: "center", marginTop: 40,
        }}>
          <Image size={32} color={t.gold} strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <h3 style={{ fontFamily: "'Tangerine', cursive", fontSize: 36, color: "#fff", marginBottom: 8 }}>
            Have a specific style in mind?
          </h3>
          <p style={{ fontSize: 14, color: "#999", marginBottom: 24, maxWidth: 380, margin: "0 auto 24px" }}>
            Upload a picture during booking and get a personalised quote within 24 hours.
          </p>
          <GoldButton onClick={() => navigate("book")} style={{
            background: t.gold, color: "#0A0A0A", border: "none",
            padding: "12px 32px", fontSize: 14, fontWeight: 700,
            cursor: "pointer", borderRadius: 6,
          }}>Start Booking</GoldButton>
        </div>
      </FadeIn>
    </section>
  );
}
