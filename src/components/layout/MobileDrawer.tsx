import { Home, Scissors, User, Image, Calendar, Search } from "lucide-react";
import type { NavigateFn } from "../../types";
import { ThemeToggle } from "../ui/ThemeToggle";

interface MobileDrawerProps {
  navigate: NavigateFn;
  page: string;
  open: boolean;
}

const NAV_KEYS = ["home", "services", "about", "gallery", "book", "track"] as const;
const NAV_LABELS: Record<string, string> = { home: "Home", services: "Services", about: "About", gallery: "Gallery", book: "Book Now", track: "Track Booking" };

export function MobileDrawer({ navigate, page, open }: MobileDrawerProps) {
  if (!open) return null;

  return (
    <div className="mobile-drawer fixed top-16 inset-x-0 bottom-0 z-[99] bg-bg p-6 [animation:slideUp_0.3s_ease_forwards]">
      {NAV_KEYS.map(key => (
        <button
          key={key} onClick={() => navigate(key)}
          className={`flex items-center gap-3 w-full py-4 px-0 bg-transparent border-0 border-b border-b-border cursor-pointer text-base ${page === key ? "text-gold font-bold" : "text-text font-medium"}`}
        >
          {key === "home" && <Home size={18} />}
          {key === "services" && <Scissors size={18} />}
          {key === "about" && <User size={18} />}
          {key === "gallery" && <Image size={18} />}
          {key === "book" && <Calendar size={18} />}
          {key === "track" && <Search size={18} />}
          {NAV_LABELS[key]}
        </button>
      ))}
      <div className="mt-6">
        <p className="text-xs text-text-muted mb-3 tracking-[2px]">THEME</p>
        <ThemeToggle variant="labeled" />
      </div>
    </div>
  );
}
