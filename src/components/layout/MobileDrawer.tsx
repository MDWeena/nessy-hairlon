import { Home, Scissors, Image, Calendar } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { NavigateFn } from "../../types";
import { ThemeToggle } from "../ui/ThemeToggle";

interface MobileDrawerProps {
  navigate: NavigateFn;
  page: string;
  open: boolean;
}

const NAV_KEYS = ["home", "services", "gallery", "book"] as const;
const NAV_LABELS: Record<string, string> = { home: "Home", services: "Services", gallery: "Gallery", book: "Book Now" };

export function MobileDrawer({ navigate, page, open }: MobileDrawerProps) {
  const { t } = useTheme();

  if (!open) return null;

  return (
    <div className="mobile-drawer" style={{
      position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 99,
      background: t.bg, padding: "24px", animation: "slideUp 0.3s ease forwards",
    }}>
      {NAV_KEYS.map(key => (
        <button key={key} onClick={() => navigate(key)} style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%",
          padding: "16px 0", borderBottom: `1px solid ${t.border}`,
          background: "none", border: "none", borderBottomWidth: 1,
          borderBottomStyle: "solid", borderBottomColor: t.border,
          cursor: "pointer", color: page === key ? t.gold : t.text,
          fontWeight: page === key ? 700 : 500, fontSize: 16,
        }}>
          {key === "home" && <Home size={18} />}
          {key === "services" && <Scissors size={18} />}
          {key === "gallery" && <Image size={18} />}
          {key === "book" && <Calendar size={18} />}
          {NAV_LABELS[key]}
        </button>
      ))}
      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 12, letterSpacing: 2 }}>THEME</p>
        <ThemeToggle variant="labeled" />
      </div>
    </div>
  );
}
