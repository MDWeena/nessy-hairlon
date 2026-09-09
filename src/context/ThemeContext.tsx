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
