import { Bell, Menu } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface AdminTopBarProps {
  adminPage: string;
  onMenuClick: () => void;
}

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Bookings",
  availability: "Availability",
  services: "Services",
  stories: "Client Stories",
  gallery: "Gallery",
  settings: "Settings",
};

export function AdminTopBar({ adminPage, onMenuClick }: AdminTopBarProps) {
  const { t } = useTheme();

  return (
    <div className="flex justify-between items-center mb-7 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="admin-hamburger tap-target-sm hidden bg-transparent border border-border rounded-lg cursor-pointer shrink-0"
          onClick={onMenuClick}
        >
          <Menu size={18} color={t.text} />
        </button>
        <h1 className="text-[22px] font-bold truncate">{TITLES[adminPage]}</h1>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div
          className="w-9 h-9 rounded-full bg-gold-bg flex items-center justify-center"
          style={{ border: `1px solid ${t.gold}30` }}
        >
          <Bell size={16} color={t.gold} />
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ background: `linear-gradient(135deg, ${t.gold}, #A67B4F)` }}
        >N</div>
      </div>
    </div>
  );
}
