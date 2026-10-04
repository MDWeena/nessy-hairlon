import { useTheme } from "../../context/ThemeContext";

interface GoldSpinnerProps {
  size?: number;
  /** Override the ring color — needed on a solid-gold background, where the default gold-on-gold would be invisible. */
  color?: string;
}

/** Small rotating ring for inline/button loading states — the branded alternative to a generic spinner icon. */
export function GoldSpinner({ size = 16, color }: GoldSpinnerProps) {
  const { t } = useTheme();
  const ringColor = color ?? t.gold;
  return (
    <span
      className="inline-block rounded-full shrink-0 [animation:loaderSpin_0.8s_linear_infinite]"
      style={{ width: size, height: size, border: `2px solid ${ringColor}30`, borderTopColor: ringColor }}
    />
  );
}
