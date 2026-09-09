import { statusColors } from "../../constants/statusColors";
import type { OrderStatus } from "../../types";

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusColors[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12,
      background: cfg.bg, color: cfg.text,
    }}>{cfg.label}</span>
  );
}
