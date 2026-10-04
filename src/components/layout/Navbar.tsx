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

const NAV_KEYS = ["home", "services", "about", "gallery", "book"] as const;
const NAV_LABELS: Record<string, string> = { home: "Home", services: "Services", about: "About", gallery: "Gallery", book: "Book Now" };

export function Navbar({ navigate, page, scrolled, mobileNavOpen, onToggleMobileNav }: NavbarProps) {
  const { t, isDark } = useTheme();

  // Nav is transparent ONLY when: dark mode + home page + not scrolled past hero
  const navTransparent = isDark && page === "home" && !scrolled;
  const showLogoText = !scrolled;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] px-6 flex items-center justify-between h-16 [transition:background_0.5s_ease,border-color_0.5s_ease] ${
        navTransparent
          ? "bg-transparent backdrop-blur-none border-b border-transparent shadow-none"
          : "bg-nav-bg backdrop-blur-lg border-b border-border shadow-theme"
      }`}
    >
      <button onClick={() => navigate("home")} className="bg-transparent border-none cursor-pointer flex items-center gap-2">
        <img src={LOGO_ICON} alt="Nessy Hairlon" className="w-9 h-9 rounded-full" />
        <span
          className={`font-cursive text-[30px] font-bold leading-none inline-block overflow-hidden whitespace-nowrap origin-left [transition:transform_0.8s_cubic-bezier(0.25,0.1,0.25,1),max-width_0.8s_cubic-bezier(0.25,0.1,0.25,1),opacity_0.6s_ease,color_0.5s_ease] ${
            navTransparent ? "text-white" : "text-text"
          } ${showLogoText ? "scale-100 max-w-[250px] opacity-100" : "scale-0 max-w-0 opacity-0"}`}
        >Nessy <span className="text-gold">Hairlon</span></span>
      </button>

      <div className="desktop-nav flex items-center gap-2">
        {NAV_KEYS.map(key => (
          <button
            key={key} onClick={() => navigate(key)}
            className={`bg-transparent border-none cursor-pointer text-[13px] py-2 px-3 tracking-[0.3px] border-b-2 [transition:all_0.3s_ease] ${
              page === key
                ? "text-gold font-bold border-gold"
                : `font-medium border-transparent ${navTransparent ? "text-[#ccc]" : "text-text-soft"}`
            }`}
          >{NAV_LABELS[key]}</button>
        ))}

        <ThemeToggle variant="nav" transparent={navTransparent} />
      </div>

      {/* Mobile hamburger */}
      <button
        className="mobile-menu-btn tap-target-sm bg-transparent border-none cursor-pointer p-1 hidden items-center"
        onClick={onToggleMobileNav}
      >
        <HairMenuIcon open={mobileNavOpen} color={navTransparent ? "#fff" : t.text} />
      </button>
    </nav>
  );
}
