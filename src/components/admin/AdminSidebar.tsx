import { TrendingUp, Calendar, Clock, Scissors, Star, Image, Settings, LogOut, ExternalLink } from "lucide-react";
import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";
import { useTestimonials } from "../../hooks/useTestimonials";
import { ThemeToggle } from "../ui/ThemeToggle";

interface AdminSidebarProps {
  adminPage: string;
  onSwitchPage: (page: string) => void;
  onViewSite: () => void;
  onLogout: () => void;
}

const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: TrendingUp },
  { key: "orders", label: "Bookings", icon: Calendar },
  { key: "availability", label: "Availability", icon: Clock },
  { key: "services", label: "Services", icon: Scissors },
  { key: "stories", label: "Client Stories", icon: Star },
  { key: "gallery", label: "Gallery", icon: Image },
  { key: "settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ adminPage, onSwitchPage, onViewSite, onLogout }: AdminSidebarProps) {
  const { t } = useTheme();
  const { testimonials } = useTestimonials();
  const pendingReviewCount = testimonials.filter(story => story.verified && !story.visible).length;

  return (
    <aside style={{
      width: 220, background: t.surface, borderRight: `1px solid ${t.border}`,
      padding: "20px 12px", display: "flex", flexDirection: "column",
      height: "100vh", overflowY: "auto", boxSizing: "border-box", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 20px", borderBottom: `1px solid ${t.border}` }}>
        <img src={LOGO_ICON} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
        <span style={{ fontFamily: "'Tangerine', cursive", fontSize: 28, fontWeight: 700 }}>Nessy <span style={{ color: t.gold }}>Hairlon</span></span>
      </div>
      <p style={{ fontSize: 10, color: t.textMuted, padding: "8px 12px 16px", letterSpacing: 2 }}>ADMIN PANEL</p>

      <div style={{ flex: 1 }}>
        {SIDEBAR_ITEMS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => onSwitchPage(key)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
            background: adminPage === key ? t.goldBg : "transparent",
            color: adminPage === key ? t.gold : t.textSoft,
            fontWeight: adminPage === key ? 700 : 500, fontSize: 13,
            marginBottom: 2, transition: "all 0.2s ease",
          }}>
            <Icon size={16} strokeWidth={1.5} /> {label}
            {key === "stories" && pendingReviewCount > 0 && (
              <span style={{
                marginLeft: "auto", background: t.gold, color: "#0A0A0A",
                fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 7px",
              }}>{pendingReviewCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Theme toggle */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, marginBottom: 12 }}>
        <ThemeToggle variant="sidebar" />
      </div>

      <button onClick={onViewSite} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
        background: "transparent", color: t.textMuted, fontSize: 13,
      }}>
        <ExternalLink size={16} strokeWidth={1.5} /> View site
      </button>

      <button onClick={onLogout} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
        background: "transparent", color: t.textMuted, fontSize: 13,
      }}>
        <LogOut size={16} strokeWidth={1.5} /> Sign Out
      </button>
    </aside>
  );
}
