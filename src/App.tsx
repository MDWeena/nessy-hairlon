import { useState } from "react";
import { useTheme } from "./context/ThemeContext";
import { useScrollPosition } from "./hooks/useScrollPosition";
import { usePageTransition } from "./hooks/usePageTransition";
import type { NavigateFn } from "./types";
import { Navbar } from "./components/layout/Navbar";
import { MobileDrawer } from "./components/layout/MobileDrawer";
import { Footer } from "./components/layout/Footer";
import { ClientLoader } from "./components/loaders/ClientLoader";
import { HomePage } from "./pages/HomePage";
import { ServicesPage } from "./pages/ServicesPage";
import { GalleryPage } from "./pages/GalleryPage";
import { BookingPage } from "./pages/BookingPage";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminPanel } from "./pages/AdminPanel";

export default function App() {
  const { t, isDark } = useTheme();
  const scrolled = useScrollPosition();
  const { page, navigate: rawNavigate, pageLoading } = usePageTransition();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);

  const navigate: NavigateFn = (p) => {
    setMobileNavOpen(false);
    rawNavigate(p);
  };

  if (isAdmin && !adminAuth) {
    return <AdminLogin onLogin={() => setAdminAuth(true)} onBack={() => setIsAdmin(false)} />;
  }
  if (isAdmin && adminAuth) {
    return <AdminPanel onLogout={() => { setIsAdmin(false); setAdminAuth(false); }} />;
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: t.text, background: t.bg, minHeight: "100vh", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />

      <Navbar
        navigate={navigate}
        page={page}
        scrolled={scrolled}
        mobileNavOpen={mobileNavOpen}
        onToggleMobileNav={() => setMobileNavOpen(v => !v)}
      />

      <MobileDrawer navigate={navigate} page={page} open={mobileNavOpen} />

      {/* Spacer — only hidden when dark mode hero bleeds behind nav */}
      {!(isDark && page === "home") && <div style={{ height: 64 }} />}

      {/* PAGES */}
      {pageLoading ? <ClientLoader /> : (
        <>
          {page === "home" && <HomePage navigate={navigate} />}
          {page === "services" && <ServicesPage navigate={navigate} />}
          {page === "gallery" && <GalleryPage navigate={navigate} />}
          {page === "book" && <BookingPage />}
        </>
      )}

      <Footer navigate={navigate} onManageClick={() => setIsAdmin(true)} />
    </div>
  );
}
