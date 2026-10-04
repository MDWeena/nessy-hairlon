import { TrendingUp, Calendar, Clock, Scissors, Star, Image, Settings, LogOut, ExternalLink, X } from "lucide-react";
import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";
import { useTestimonials } from "../../hooks/useTestimonials";
import { ThemeToggle } from "../ui/ThemeToggle";

interface AdminSidebarProps {
  adminPage: string;
  onSwitchPage: (page: string) => void;
  onViewSite: () => void;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
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

export function AdminSidebar({ adminPage, onSwitchPage, onViewSite, onLogout, open, onClose }: AdminSidebarProps) {
  const { t } = useTheme();
  const { testimonials } = useTestimonials();
  const pendingReviewCount = testimonials.filter(story => story.verified && !story.visible).length;

  return (
    <aside
      className={`admin-sidebar${open ? " open" : ""} bg-surface border-r border-border py-5 px-3 flex flex-col h-screen overflow-y-auto box-border shrink-0`}
      style={{ width: 220 /* must stay inline: .admin-sidebar's mobile width:260px rule has no !important, so a Tailwind class here would out-rank it and break the drawer width */ }}
    >
      <div className="flex items-center gap-2 px-2 pb-5 border-b border-border">
        <img src={LOGO_ICON} alt="" className="w-8 h-8 rounded-full" />
        <span className="font-cursive text-[28px] font-bold flex-1">Nessy <span className="text-gold">Hairlon</span></span>
        <button className="admin-sidebar-close tap-target-sm hidden bg-transparent border-none cursor-pointer shrink-0" onClick={onClose}>
          <X size={20} color={t.textMuted} />
        </button>
      </div>
      <p className="text-[10px] text-text-muted pt-2 pb-4 px-3 tracking-[2px]">ADMIN PANEL</p>

      <div className="flex-1">
        {SIDEBAR_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key} onClick={() => { onSwitchPage(key); onClose(); }}
            className={`flex items-center gap-2.5 w-full py-2.5 px-3 rounded-lg border-none cursor-pointer text-[13px] mb-0.5 [transition:all_0.2s_ease] ${
              adminPage === key ? "bg-gold-bg text-gold font-bold" : "bg-transparent text-text-soft font-medium"
            }`}
          >
            <Icon size={16} strokeWidth={1.5} /> {label}
            {key === "stories" && pendingReviewCount > 0 && (
              <span className="ml-auto bg-gold text-theme-black text-[10px] font-bold rounded-[10px] py-px px-[7px]">{pendingReviewCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Theme toggle */}
      <div className="border-t border-border pt-3 mb-3">
        <ThemeToggle variant="sidebar" />
      </div>

      <button onClick={onViewSite} className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border-none cursor-pointer bg-transparent text-text-muted text-[13px]">
        <ExternalLink size={16} strokeWidth={1.5} /> View site
      </button>

      <button onClick={onLogout} className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border-none cursor-pointer bg-transparent text-text-muted text-[13px]">
        <LogOut size={16} strokeWidth={1.5} /> Sign Out
      </button>
    </aside>
  );
}
