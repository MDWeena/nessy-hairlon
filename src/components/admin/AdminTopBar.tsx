import { Bell } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface AdminTopBarProps {
  adminPage: string;
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

export function AdminTopBar({ adminPage }: AdminTopBarProps) {
  const { t } = useTheme();

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>{TITLES[adminPage]}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
