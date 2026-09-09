import { Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface ProgressBarProps {
  step: number;
}

const LABELS = ["Date & Time", "Services", "Review"];

export function ProgressBar({ step }: ProgressBarProps) {
  const { t } = useTheme();
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 40 }}>
      {LABELS.map((label, i) => (
        <div key={label} style={{ flex: 1 }}>
          <div style={{
            height: 3, borderRadius: 2,
            background: i <= step ? t.gold : t.border,
            transition: "background 0.5s ease",
          }} />
          <span style={{
            fontSize: 11, marginTop: 6, display: "flex", alignItems: "center", gap: 4,
            color: i <= step ? t.text : t.textMuted,
            fontWeight: i === step ? 700 : 400,
          }}>
            {i < step ? <Check size={12} color={t.gold} /> : null} {label}
          </span>
        </div>
      ))}
    </div>
  );
}
