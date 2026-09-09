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
      <div style={{
        display: "flex", justifyContent: "center", gap: 48, padding: "36px 24px",
        borderBottom: `1px solid ${t.border}`, flexWrap: "wrap",
      }}>
        {ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, color: t.textSoft, fontSize: 13 }}>
            <Icon size={16} color={t.gold} strokeWidth={1.5} /> {label}
          </div>
        ))}
      </div>
    </FadeIn>
  );
}
