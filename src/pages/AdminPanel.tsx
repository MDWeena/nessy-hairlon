import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { ProtectedRoute } from "../components/admin/ProtectedRoute";
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
import type { OrderFilter } from "../types";

interface AdminPanelProps {
  onViewSite: () => void;
  onLogout: () => void;
  deepLinkBookingId?: string | null;
}

export function AdminPanel({ onViewSite, onLogout, deepLinkBookingId }: AdminPanelProps) {
  const { t } = useTheme();
  const [adminPage, setAdminPage] = useState(deepLinkBookingId ? "orders" : "dashboard");
  const [adminLoading, setAdminLoading] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState<OrderFilter>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const switchAdminPage = (p: string, filter?: OrderFilter) => {
    setOrdersFilter(filter ?? "all");
    if (p === adminPage) return;
    setAdminLoading(true);
    setTimeout(() => { setAdminPage(p); setAdminLoading(false); }, 500);
  };

  return (
    <ProtectedRoute onBack={onViewSite}>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: t.text, background: t.bg, height: "100vh", display: "flex", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />

        {sidebarOpen && (
          <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199,
          }} />
        )}

        <AdminSidebar
          adminPage={adminPage} onSwitchPage={switchAdminPage} onViewSite={onViewSite} onLogout={onLogout}
          open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <main className="admin-main" style={{ flex: 1, padding: "28px 32px", height: "100vh", overflowY: "auto", boxSizing: "border-box" }}>
          <AdminTopBar adminPage={adminPage} onMenuClick={() => setSidebarOpen(true)} />

          {adminLoading ? <AdminLoader /> : (
            <>
              {adminPage === "dashboard" && <Dashboard onNavigate={switchAdminPage} />}
              {adminPage === "orders" && <Orders initialFilter={ordersFilter} highlightBookingId={deepLinkBookingId} />}
              {adminPage === "availability" && <Availability />}
              {adminPage === "services" && <ServicesManager />}
              {adminPage === "stories" && <ClientStories />}
              {adminPage === "gallery" && <GalleryManager />}
              {adminPage === "settings" && <Settings />}
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
