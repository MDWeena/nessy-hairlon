import type { OrderStatus, StatusConfig } from "../types";

export const statusColors: Record<OrderStatus, StatusConfig> = {
  pending_review: { bg: "#FEF3C7", text: "#92400E", label: "Needs Review" },
  quoted: { bg: "#DBEAFE", text: "#1E40AF", label: "Quoted" },
  confirmed: { bg: "#D1FAE5", text: "#065F46", label: "Confirmed" },
  completed: { bg: "#E0E7FF", text: "#3730A3", label: "Completed" },
  cancelled: { bg: "#FEE2E2", text: "#991B1B", label: "Cancelled" },
};
