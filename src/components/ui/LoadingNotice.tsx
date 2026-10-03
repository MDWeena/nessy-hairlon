import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";

interface LoadingNoticeProps {
  label?: string;
  /** Fixed full-screen overlay, matching the app's initial-load screen (ClientLoader). Defaults to a smaller inline/section loader. */
  fullPage?: boolean;
}

export function LoadingNotice({ label = "Loading…", fullPage = false }: LoadingNoticeProps) {
  const { t } = useTheme();
  const boxSize = fullPage ? 160 : 72;
  const logoSize = fullPage ? 120 : 52;
  const ringInset = fullPage ? -10 : -4;

  const mark = (
    <div style={{ width: boxSize, height: boxSize, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: ringInset, borderRadius: "50%", border: `1.5px solid ${t.gold}`, opacity: 0, animation: "ringExpand 2s ease-out infinite" }} />
      <div style={{ position: "absolute", inset: ringInset, borderRadius: "50%", border: `1.5px solid ${t.gold}`, opacity: 0, animation: "ringExpand 2s ease-out 0.6s infinite" }} />
      <div style={{ position: "absolute", inset: ringInset, borderRadius: "50%", border: `1.5px solid ${t.gold}`, opacity: 0, animation: "ringExpand 2s ease-out 1.2s infinite" }} />
      <img src={LOGO_ICON} alt="" style={{ width: logoSize, height: logoSize, borderRadius: "50%", position: "relative", zIndex: 2, animation: "loaderPulse 2s ease-in-out infinite" }} />
    </div>
  );

  if (fullPage) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        {mark}
        <span style={{ fontFamily: "'Tangerine', cursive", fontSize: 32, color: t.gold, opacity: 0.7 }}>{label}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "32px 0" }}>
      {mark}
      <span style={{ fontSize: 13, color: t.textMuted }}>{label}</span>
    </div>
  );
}
