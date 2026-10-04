import { Check } from "lucide-react";
import type { ServiceItem } from "../../types";

interface ServiceCardProps {
  service: ServiceItem;
  selected: boolean;
  onToggle: () => void;
}

export function ServiceCard({ service, selected, onToggle }: ServiceCardProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex justify-between items-center py-3.5 px-4 rounded-[10px] cursor-pointer text-left [transition:all_0.2s] ${
        selected ? "border-2 border-gold bg-gold-bg" : "border border-border bg-surface"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {service.imageUrl ? (
          <img src={service.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
        ) : null}
        <div className="min-w-0">
          <div className="font-semibold text-sm text-text truncate">{service.name}</div>
          <div className="text-xs text-text-muted mt-0.5">{service.desc}</div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 ml-3 shrink-0">
        <span className={`text-[13px] font-bold ${service.price ? "text-text" : "text-gold"}`}>{service.price || service.priceRange || "Quote"}</span>
        <div
          className={`w-[22px] h-[22px] rounded-full flex items-center justify-center [transition:all_0.2s] ${
            selected ? "border-none bg-gold" : "border-2 border-border bg-transparent"
          }`}
        >{selected && <Check size={14} color="#fff" strokeWidth={3} />}</div>
      </div>
    </button>
  );
}
