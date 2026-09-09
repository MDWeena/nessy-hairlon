import { Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { ServiceItem } from "../../types";

interface ServiceCardProps {
  service: ServiceItem;
  selected: boolean;
  onToggle: () => void;
}

export function ServiceCard({ service, selected, onToggle }: ServiceCardProps) {
  const { t } = useTheme();
  return (
    <button onClick={onToggle} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 16px", borderRadius: 10, cursor: "pointer",
      border: selected ? `2px solid ${t.gold}` : `1px solid ${t.border}`,
      background: selected ? t.goldBg : t.surface,
      textAlign: "left", transition: "all 0.2s",
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{service.name}</div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{service.desc}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: service.price ? t.text : t.gold }}>{service.price || service.priceRange || "Quote"}</span>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          border: selected ? "none" : `2px solid ${t.border}`,
          background: selected ? t.gold : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}>{selected && <Check size={14} color="#fff" strokeWidth={3} />}</div>
      </div>
    </button>
  );
}
