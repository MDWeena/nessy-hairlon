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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button className="admin-hamburger tap-target-sm" onClick={onMenuClick} style={{
          display: "none", background: "none", border: `1px solid ${t.border}`, borderRadius: 8,
          cursor: "pointer", flexShrink: 0,
        }}>
          <Menu size={18} color={t.text} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{TITLES[adminPage]}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: t.goldBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${t.gold}30`,
        }}>
          <Bell size={16} color={t.gold} />
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: `linear-gradient(135deg, ${t.gold}, #A67B4F)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 14, fontWeight: 700,
        }}>N</div>
      </div>
    </div>
  );
}
