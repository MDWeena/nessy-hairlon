import type { CSSProperties } from "react";
import { useTheme } from "../../context/ThemeContext";

/** Digits-only display with comma grouping — these inputs always represent whole-naira amounts, never kobo. */
export function formatMoneyDisplay(value: number): string {
  return value ? value.toLocaleString() : "";
}

export function parseMoneyInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: CSSProperties;
}

/** A ₦-prefixed money input with comma-formatted display and no spinner arrows (type="text" under the hood, digits-only). */
export function MoneyInput({ value, onChange, placeholder, autoFocus, style }: MoneyInputProps) {
  const { t } = useTheme();
  return (
    <div style={{ position: "relative", ...style }}>
      <span style={{
        position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
        fontSize: "inherit", color: t.textMuted, pointerEvents: "none",
      }}>₦</span>
      <input
        type="text" inputMode="numeric"
        value={formatMoneyDisplay(value)}
        onChange={(e) => onChange(parseMoneyInput(e.target.value))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: "100%", padding: "6px 8px 6px 20px", borderRadius: 6, border: `1px solid ${t.border}`,
          background: t.bgAlt, fontSize: "inherit", color: t.text, outline: "none", boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}
