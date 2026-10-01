import { useEffect } from "react";
import { X, Clock, ArrowRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "./GoldButton";

interface StyleDetailModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title: string;
  subtitle?: string;
  description?: string | null;
  duration?: string | null;
  price?: string | null;
  priceNote?: string | null;
  ctaLabel: string;
  onBook: () => void;
}

export function StyleDetailModal({
  open, onClose, imageUrl, title, subtitle, description, duration, price, priceNote, ctaLabel, onBook,
}: StyleDetailModalProps) {
  const { t, isDark } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: isDark ? "rgba(0,0,0,0.75)" : "rgba(10,8,6,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, boxSizing: "border-box",
        animation: "modalOverlayIn 0.25s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface, borderRadius: 20, overflow: "hidden",
          width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto",
          border: `1px solid ${t.border}`, position: "relative",
          animation: "modalContentIn 0.3s cubic-bezier(0.25,0.1,0.25,1)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <button onClick={onClose} className="tap-target-sm" style={{
          position: "absolute", top: 12, right: 12, zIndex: 2,
          background: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.85)",
          backdropFilter: "blur(8px)", border: `1px solid ${t.border}`,
          borderRadius: "50%", width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <X size={18} color={t.text} />
        </button>

        {imageUrl ? (
          <img src={imageUrl} alt={title} style={{
            width: "100%", maxWidth: 600, aspectRatio: "4 / 3", objectFit: "cover", display: "block",
          }} />
        ) : (
          <div style={{
            width: "100%", aspectRatio: "4 / 3",
            background: `linear-gradient(135deg, ${t.gold}25, ${t.gold}08)`,
          }} />
        )}

        <div style={{ padding: "28px 28px 32px" }}>
          {subtitle && (
            <p style={{ color: t.gold, fontSize: 11, fontWeight: 600, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
              {subtitle}
            </p>
          )}
          <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 40, fontWeight: 700, marginBottom: 12, color: t.text }}>
            {title}
          </h2>

          {description && (
            <p style={{ fontSize: 14, color: t.textSoft, lineHeight: 1.7, marginBottom: 16 }}>{description}</p>
          )}

          {(duration || price) && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
              background: t.goldBg, border: `1px solid ${t.gold}30`, borderRadius: 12, padding: "14px 18px", marginBottom: 24,
            }}>
              {duration && (
                <span style={{ fontSize: 13, color: t.textSoft, display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock size={14} color={t.gold} /> {duration}
                </span>
              )}
              {price && (
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: t.text, display: "block" }}>{price}</span>
                  {priceNote && <span style={{ fontSize: 11, color: t.gold }}>{priceNote}</span>}
                </div>
              )}
            </div>
          )}

          <GoldButton onClick={onBook} style={{
            width: "100%", background: t.gold, color: "#0A0A0A", border: "none",
            padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {ctaLabel} <ArrowRight size={16} />
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
