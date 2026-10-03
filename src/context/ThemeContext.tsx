import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { themes } from "../constants/themes";
import type { Theme, ThemeMode } from "../types";

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  t: Theme;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (themeMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      setResolvedTheme(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) => setResolvedTheme(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    setResolvedTheme(themeMode);
  }, [themeMode]);

  const t = themes[resolvedTheme];
  const isDark = resolvedTheme === "dark";

  // Mirror every theme token onto :root as a CSS custom property, so Tailwind utility
  // classes (bg-surface, text-[var(--gold)], etc.) stay correct in both light and dark
  // mode without needing a separate dark: variant — the variable's value just changes.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--bg", t.bg);
    root.setProperty("--bg-alt", t.bgAlt);
    root.setProperty("--surface", t.surface);
    root.setProperty("--surface-hover", t.surfaceHover);
    root.setProperty("--text", t.text);
    root.setProperty("--text-soft", t.textSoft);
    root.setProperty("--text-muted", t.textMuted);
    root.setProperty("--gold", t.gold);
    root.setProperty("--gold-dark", t.goldDark);
    root.setProperty("--gold-light", t.goldLight);
    root.setProperty("--gold-bg", t.goldBg);
    root.setProperty("--border", t.border);
    root.setProperty("--border-strong", t.borderStrong);
    root.setProperty("--black", t.black);
    root.setProperty("--white", t.white);
    root.setProperty("--nav-bg", t.navBg);
    root.setProperty("--shadow", t.shadow);
    root.setProperty("--hero-overlay", t.heroOverlay);
    root.setProperty("--card-shadow", t.cardShadow);
  }, [t]);

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, t, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
