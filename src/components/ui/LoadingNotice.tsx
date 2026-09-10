import { useTheme } from "../../context/ThemeContext";

interface LoadingNoticeProps {
  label?: string;
}

export function LoadingNotice({ label = "Loading…" }: LoadingNoticeProps) {
  const { t } = useTheme();
  return (
    <p style={{ fontSize: 14, color: t.textMuted, padding: "24px 0", textAlign: "center" }}>{label}</p>
  );
}
