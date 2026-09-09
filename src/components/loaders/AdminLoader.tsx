import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";

export function AdminLoader() {
  const { t } = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ width: 160, height: 160, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1px solid ${t.gold}15` }} />
        <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: `1px solid ${t.gold}10` }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2.5px solid transparent", borderTopColor: t.gold, borderBottomColor: `${t.gold}30`, animation: "loaderSpin 1.4s linear infinite" }} />
        <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "2px solid transparent", borderLeftColor: "#D4B896", borderRightColor: "#D4B89640", animation: "loaderSpin 2s linear infinite reverse" }} />
        <img src={LOGO_ICON} alt="" style={{ width: 100, height: 100, borderRadius: "50%", position: "relative", zIndex: 2, animation: "loaderPulseAdmin 2.4s ease-in-out infinite" }} />
      </div>
      <span style={{ fontSize: 14, color: t.textMuted }}>Loading...</span>
    </div>
  );
}
