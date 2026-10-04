import { statusColors } from "../../constants/statusColors";
import type { OrderStatus } from "../../types";

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusColors[status];
  return (
    <span
      className="text-[11px] font-semibold py-[3px] px-[10px] rounded-[12px]"
      style={{ background: cfg.bg, color: cfg.text }}
    >{cfg.label}</span>
  );
}
