import { Clock, Users, Star, MapPin } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { FadeIn } from "../ui/FadeIn";

const ITEMS = [
  { icon: Clock, label: "6+ years experience" },
  { icon: Users, label: "1,000+ happy clients" },
  { icon: Star, label: "4.9 average rating" },
  { icon: MapPin, label: "Home service available" },
];

export function TrustBar() {
  const { t } = useTheme();
  return (
    <FadeIn>
      <div className="trust-bar flex justify-center gap-12 py-9 px-6 border-b border-border flex-wrap">
        {ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-text-soft text-[13px]">
            <Icon size={16} color={t.gold} strokeWidth={1.5} /> {label}
          </div>
        ))}
      </div>
    </FadeIn>
  );
}
