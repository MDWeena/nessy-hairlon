import type { CSSProperties } from "react";

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
  return (
    <div className="relative" style={style}>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none [font-size:inherit]">₦</span>
      <input
        type="text" inputMode="numeric"
        value={formatMoneyDisplay(value)}
        onChange={(e) => onChange(parseMoneyInput(e.target.value))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full py-1.5 pr-2 pl-5 rounded-md border border-border bg-bg-alt text-text outline-none box-border [font-size:inherit] [font-family:inherit]"
      />
    </div>
  );
}
