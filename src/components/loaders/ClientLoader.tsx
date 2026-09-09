import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";

export function ClientLoader() {
  const { t } = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ width: 160, height: 160, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", inset: -10, borderRadius: "50%", border: `1.5px solid ${t.gold}`, opacity: 0, animation: "ringExpand 2s ease-out infinite" }} />
        <div style={{ position: "absolute", inset: -10, borderRadius: "50%", border: `1.5px solid ${t.gold}`, opacity: 0, animation: "ringExpand 2s ease-out 0.6s infinite" }} />
        <div style={{ position: "absolute", inset: -10, borderRadius: "50%", border: `1.5px solid ${t.gold}`, opacity: 0, animation: "ringExpand 2s ease-out 1.2s infinite" }} />
        <img src={LOGO_ICON} alt="" style={{ width: 120, height: 120, borderRadius: "50%", position: "relative", zIndex: 2, animation: "loaderPulse 2s ease-in-out infinite" }} />
      </div>
      <span style={{ fontFamily: "'Tangerine', cursive", fontSize: 32, color: t.gold, opacity: 0.7 }}>Loading...</span>
    </div>
  );
}
