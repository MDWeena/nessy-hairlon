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
      className={`fixed inset-0 z-[300] backdrop-blur-sm flex items-center justify-center p-4 box-border [animation:modalOverlayIn_0.25s_ease] ${
        isDark ? "bg-[rgba(0,0,0,0.75)]" : "bg-[rgba(10,8,6,0.6)]"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[20px] overflow-hidden w-full max-w-[600px] max-h-[90vh] overflow-y-auto border border-border relative [animation:modalContentIn_0.3s_cubic-bezier(0.25,0.1,0.25,1)] shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
      >
        <button
          onClick={onClose}
          className={`tap-target-sm absolute top-3 right-3 z-[2] backdrop-blur border border-border rounded-full w-9 h-9 flex items-center justify-center cursor-pointer ${
            isDark ? "bg-[rgba(0,0,0,0.5)]" : "bg-[rgba(255,255,255,0.85)]"
          }`}
        >
          <X size={18} color={t.text} />
        </button>

        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full max-w-[600px] aspect-[4/3] object-cover block" />
        ) : (
          <div
            className="w-full aspect-[4/3]"
            style={{ background: `linear-gradient(135deg, ${t.gold}25, ${t.gold}08)` }}
          />
        )}

        <div className="pt-7 px-7 pb-8">
          {subtitle && (
            <p className="text-gold text-[11px] font-semibold tracking-[2px] mb-2 uppercase">
              {subtitle}
            </p>
          )}
          <h2 className="font-cursive text-[40px] font-bold mb-3 text-text">
            {title}
          </h2>

          {description && (
            <p className="text-sm text-text-soft leading-[1.7] mb-4">{description}</p>
          )}

          {(duration || price) && (
            <div
              className="flex items-center justify-between flex-wrap gap-3 bg-gold-bg rounded-xl py-3.5 px-[18px] mb-6"
              style={{ border: `1px solid ${t.gold}30` }}
            >
              {duration && (
                <span className="text-[13px] text-text-soft flex items-center gap-1.5">
                  <Clock size={14} color={t.gold} /> {duration}
                </span>
              )}
              {price && (
                <div className="text-right">
                  <span className="text-lg font-bold text-text block">{price}</span>
                  {priceNote && <span className="text-[11px] text-gold">{priceNote}</span>}
                </div>
              )}
            </div>
          )}

          <GoldButton
            onClick={onBook}
            className="w-full bg-gold text-theme-black border-none p-3.5 text-[15px] font-bold cursor-pointer rounded-lg flex items-center justify-center gap-2"
          >
            {ctaLabel} <ArrowRight size={16} />
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
