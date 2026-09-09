import { Phone, Camera, MapPin } from "lucide-react";
import type { MouseEvent } from "react";
import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";
import type { NavigateFn } from "../../types";
import { WeenaCredit } from "./WeenaCredit";

interface FooterProps {
  navigate: NavigateFn;
  onManageClick: () => void;
}

export function Footer({ navigate, onManageClick }: FooterProps) {
  const { t, isDark } = useTheme();

  return (
    <footer style={{ background: isDark ? "#0A0806" : "#1E1914", color: isDark ? "#999" : "#aaa", padding: "56px 24px 32px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <img src={LOGO_ICON} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }} />
            <span style={{ fontFamily: "'Tangerine', cursive", fontSize: 40, color: "#fff" }}>Nessy <span style={{ color: t.gold }}>Hairlon</span></span>
          </div>
          <p style={{ fontSize: 13, color: "#777", lineHeight: 1.6 }}>Natural hair specialist. Braiding, locs, treatments & styling done with care and intention.</p>
        </div>
        <div>
          <h4 style={{ color: "#ccc", fontSize: 13, fontWeight: 700, marginBottom: 16, letterSpacing: 0.5 }}>Quick links</h4>
          {["Home", "Services", "Book Now"].map(l => (
            <button key={l} onClick={() => navigate(l === "Book Now" ? "book" : l.toLowerCase())} style={{
              display: "block", background: "none", border: "none", color: "#888",
              cursor: "pointer", fontSize: 13, padding: "4px 0", marginBottom: 4,
              transition: "color 0.2s",
            }}>{l}</button>
          ))}
        </div>
        <div>
          <h4 style={{ color: "#ccc", fontSize: 13, fontWeight: 700, marginBottom: 16, letterSpacing: 0.5 }}>Get in touch</h4>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#888", fontSize: 13 }}>
            <Phone size={14} color={t.gold} /> 0816 127 1343
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#888", fontSize: 13 }}>
            <Camera size={14} color={t.gold} /> @nessy_hairlon
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#888", fontSize: 13 }}>
            <MapPin size={14} color={t.gold} /> Lagos, Nigeria
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #1E1E1E", paddingTop: 20, marginTop: 40 }}>
        {/* Top layer — Built by Weena + hidden Manage */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
          <WeenaCredit />
          <button
            onClick={onManageClick}
            style={{
              background: "none", border: "none", cursor: "default",
              color: "#2A2A2A", fontSize: 11, padding: "4px 8px",
              borderRadius: 4, transition: "all 0.3s",
              letterSpacing: 0.5,
            }}
            onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.color = t.gold; e.currentTarget.style.background = "rgba(196,154,108,0.1)"; }}
            onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.color = "#2A2A2A"; e.currentTarget.style.background = "none"; }}
          >
            Manage
          </button>
        </div>
        {/* Bottom layer — copyright centered */}
        <div style={{ textAlign: "center", fontSize: 11, color: "#444", paddingTop: 12, borderTop: "1px solid #1A1A1A" }}>
          © 2026 Nessy Hairlon. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
