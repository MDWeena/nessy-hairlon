import { Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface ProgressBarProps {
  step: number;
}

const LABELS = ["Date & Time", "Services", "Review"];

export function ProgressBar({ step }: ProgressBarProps) {
  const { t } = useTheme();
  return (
    <div className="flex gap-1 mb-10">
      {LABELS.map((label, i) => (
        <div key={label} className="flex-1">
          <div className={`h-[3px] rounded-sm [transition:background_0.5s_ease] ${i <= step ? "bg-gold" : "bg-border"}`} />
          <span className={`text-[11px] mt-1.5 flex items-center gap-1 ${i <= step ? "text-text" : "text-text-muted"} ${i === step ? "font-bold" : "font-normal"}`}>
            {i < step ? <Check size={12} color={t.gold} /> : null} {label}
          </span>
        </div>
      ))}
    </div>
  );
}
