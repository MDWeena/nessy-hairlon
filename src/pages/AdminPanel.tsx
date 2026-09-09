import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { AdminSidebar } from "../components/admin/AdminSidebar";
import { AdminTopBar } from "../components/admin/AdminTopBar";
import { AdminLoader } from "../components/loaders/AdminLoader";
import { Dashboard } from "../components/admin/Dashboard";
import { Orders } from "../components/admin/Orders";
import { Availability } from "../components/admin/Availability";
import { ServicesManager } from "../components/admin/ServicesManager";
import { ClientStories } from "../components/admin/ClientStories";
import { GalleryManager } from "../components/admin/GalleryManager";
import { Settings } from "../components/admin/Settings";

interface AdminPanelProps {
  onLogout: () => void;
}

export function AdminPanel({ onLogout }: AdminPanelProps) {
  const { t } = useTheme();
  const [adminPage, setAdminPage] = useState("dashboard");
  const [adminLoading, setAdminLoading] = useState(false);

  const switchAdminPage = (p: string) => {
    if (p === adminPage) return;
    setAdminLoading(true);
    setTimeout(() => { setAdminPage(p); setAdminLoading(false); }, 500);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: t.text, background: t.bg, minHeight: "100vh", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />

      <AdminSidebar adminPage={adminPage} onSwitchPage={switchAdminPage} onLogout={onLogout} />

      {/* Main content */}
      <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
        <AdminTopBar adminPage={adminPage} />

        {adminLoading ? <AdminLoader /> : (
          <>
            {adminPage === "dashboard" && <Dashboard />}
            {adminPage === "orders" && <Orders />}
            {adminPage === "availability" && <Availability />}
            {adminPage === "services" && <ServicesManager />}
            {adminPage === "stories" && <ClientStories />}
            {adminPage === "gallery" && <GalleryManager />}
            {adminPage === "settings" && <Settings />}
          </>
        )}
      </main>
    </div>
  );
}
