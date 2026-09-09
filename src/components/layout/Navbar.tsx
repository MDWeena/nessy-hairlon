import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";
import type { NavigateFn } from "../../types";
import { ThemeToggle } from "../ui/ThemeToggle";
import { HairMenuIcon } from "../ui/HairMenuIcon";

interface NavbarProps {
  navigate: NavigateFn;
  page: string;
  scrolled: boolean;
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
}

const NAV_KEYS = ["home", "services", "gallery", "book"] as const;
const NAV_LABELS: Record<string, string> = { home: "Home", services: "Services", gallery: "Gallery", book: "Book Now" };

export function Navbar({ navigate, page, scrolled, mobileNavOpen, onToggleMobileNav }: NavbarProps) {
  const { t, isDark } = useTheme();

  // Nav is transparent ONLY when: dark mode + home page + not scrolled past hero
  const navTransparent = isDark && page === "home" && !scrolled;
  const showLogoText = !scrolled;

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: navTransparent ? "transparent" : t.navBg,
      backdropFilter: navTransparent ? "none" : "blur(16px)",
      borderBottom: navTransparent ? "1px solid transparent" : `1px solid ${t.border}`,
      padding: "0 24px", display: "flex", alignItems: "center",
      justifyContent: "space-between", height: 64,
      transition: "background 0.5s ease, border-color 0.5s ease",
      boxShadow: navTransparent ? "none" : t.shadow,
    }}>
      <button onClick={() => navigate("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
        <img src={LOGO_ICON} alt="Nessy Hairlon" style={{ width: 36, height: 36, borderRadius: "50%" }} />
        <span style={{
          fontFamily: "'Tangerine', cursive", fontSize: 30, fontWeight: 700,
          color: navTransparent ? "#fff" : t.text, lineHeight: 1,
          display: "inline-block",
          transform: showLogoText ? "scale(1)" : "scale(0)",
          maxWidth: showLogoText ? 250 : 0,
          opacity: showLogoText ? 1 : 0,
          overflow: "hidden", whiteSpace: "nowrap",
          transformOrigin: "left center",
          transition: "transform 0.8s cubic-bezier(0.25,0.1,0.25,1), max-width 0.8s cubic-bezier(0.25,0.1,0.25,1), opacity 0.6s ease, color 0.5s ease",
        }}>Nessy <span style={{ color: t.gold }}>Hairlon</span></span>
      </button>

      <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {NAV_KEYS.map(key => (
          <button key={key} onClick={() => navigate(key)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: page === key ? t.gold : (navTransparent ? "#ccc" : t.textSoft),
            fontWeight: page === key ? 700 : 500, fontSize: 13,
            padding: "8px 12px", letterSpacing: 0.3,
            borderBottom: page === key ? `2px solid ${t.gold}` : "2px solid transparent",
            transition: "all 0.3s ease",
          }}>{NAV_LABELS[key]}</button>
        ))}

        <ThemeToggle variant="nav" transparent={navTransparent} />
      </div>

      {/* Mobile hamburger */}
      <button className="mobile-menu-btn" onClick={onToggleMobileNav} style={{
        background: "none", border: "none", cursor: "pointer", padding: 4,
        display: "none", alignItems: "center",
      }}>
        <HairMenuIcon open={mobileNavOpen} color={navTransparent ? "#fff" : t.text} />
      </button>
    </nav>
  );
}
