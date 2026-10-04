import { useState } from "react";
import { useTheme } from "./context/ThemeContext";
import { useScrollPosition } from "./hooks/useScrollPosition";
import { usePageTransition } from "./hooks/usePageTransition";
import { useAuth } from "./hooks/useAuth";
import type { NavigateFn } from "./types";
import { Navbar } from "./components/layout/Navbar";
import { MobileDrawer } from "./components/layout/MobileDrawer";
import { Footer } from "./components/layout/Footer";
import { ClientLoader } from "./components/loaders/ClientLoader";
import { HomePage } from "./pages/HomePage";
import { ServicesPage } from "./pages/ServicesPage";
import { GalleryPage } from "./pages/GalleryPage";
import { BookingPage } from "./pages/BookingPage";
import { TrackBookingPage } from "./pages/TrackBookingPage";
import { LeaveReviewPage } from "./pages/LeaveReviewPage";
import { AdminPanel } from "./pages/AdminPanel";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { WhatsAppButton } from "./components/ui/WhatsAppButton";

/** Read ?booking=<id> from the current URL (for admin deep links). */
function getDeepLinkBookingId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("booking");
  } catch { return null; }
}

export default function App() {
  const { isDark } = useTheme();
  const scrolled = useScrollPosition();
  const { page, navigate: rawNavigate, pageLoading } = usePageTransition();
  const { signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => page === "admin");
  const [preselectedService, setPreselectedService] = useState<string | null>(null);
  const [deepLinkBookingId] = useState<string | null>(() => page === "admin" ? getDeepLinkBookingId() : null);

  const navigate: NavigateFn = (p) => {
    setMobileNavOpen(false);
    rawNavigate(p);
  };

  const bookService = (serviceName: string) => {
    setPreselectedService(serviceName);
    navigate("book");
  };

  if (isAdmin) {
    return (
      <AdminPanel
        onViewSite={() => { setIsAdmin(false); navigate("home"); }}
        onLogout={async () => { await signOut(); setIsAdmin(false); navigate("home"); }}
        deepLinkBookingId={deepLinkBookingId}
      />
    );
  }

  if (page === "reset-password") {
    return (
      <ResetPasswordPage
        onGoToAdmin={() => {
          window.history.replaceState(null, "", "/");
          setIsAdmin(true);
        }}
      />
    );
  }

  return (
    <div className="font-sans text-text bg-bg min-h-screen overflow-x-hidden">
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
      {!(isDark && page === "home") && <div className="h-16" />}

      {/* PAGES */}
      {pageLoading ? <ClientLoader /> : (
        <>
          {page === "home" && <HomePage navigate={navigate} />}
          {page === "services" && <ServicesPage navigate={navigate} onBookService={bookService} />}
          {page === "gallery" && <GalleryPage navigate={navigate} onBookService={bookService} />}
          {page === "book" && (
            <BookingPage
              navigate={navigate}
              preselectedService={preselectedService}
              onConsumePreselectedService={() => setPreselectedService(null)}
            />
          )}
          {page === "track" && <TrackBookingPage navigate={navigate} />}
          {page === "review" && <LeaveReviewPage />}
        </>
      )}

      <Footer navigate={navigate} onManageClick={() => setIsAdmin(true)} />
      <WhatsAppButton />
    </div>
  );
}
