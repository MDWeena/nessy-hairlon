import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { ThemeMode } from "../../types";

interface ThemeToggleProps {
  variant?: "nav" | "sidebar" | "labeled";
  transparent?: boolean;
  /** Adds the left margin + transition used when the toggle sits inline next to nav links. */
  spaced?: boolean;
}

const OPTIONS: { mode: ThemeMode; Icon: typeof Sun; label: string }[] = [
  { mode: "light", Icon: Sun, label: "Light" },
  { mode: "dark", Icon: Moon, label: "Dark" },
  { mode: "system", Icon: Monitor, label: "System" },
];

export function ThemeToggle({ variant = "nav", transparent = false, spaced = true }: ThemeToggleProps) {
  const { themeMode, setThemeMode, t } = useTheme();

  if (variant === "labeled") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        {OPTIONS.map(({ mode, Icon, label }) => (
          <button key={mode} onClick={() => setThemeMode(mode)} style={{
            flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
            background: themeMode === mode ? t.goldBg : t.surface,
            border: `1px solid ${themeMode === mode ? t.gold : t.border}`,
            color: themeMode === mode ? t.gold : t.textSoft,
            fontWeight: themeMode === mode ? 700 : 400, fontSize: 12,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div style={{ display: "flex", background: t.bgAlt, borderRadius: 8, padding: 3 }}>
        {OPTIONS.map(({ mode, Icon }) => (
          <button key={mode} onClick={() => setThemeMode(mode)} style={{
            flex: 1, background: themeMode === mode ? t.gold : "transparent",
            border: "none", borderRadius: 6, padding: "6px", cursor: "pointer",
            color: themeMode === mode ? "#fff" : t.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}><Icon size={14} /></button>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", background: transparent ? "rgba(255,255,255,0.1)" : t.bgAlt, borderRadius: 20, padding: 3,
      border: `1px solid ${transparent ? "rgba(255,255,255,0.15)" : t.border}`,
      ...(spaced ? { marginLeft: 8, transition: "all 0.4s ease" } : {}),
    }}>
      {OPTIONS.map(({ mode, Icon }) => (
        <button key={mode} onClick={() => setThemeMode(mode)} style={{
          background: themeMode === mode ? t.gold : "transparent",
          border: "none", borderRadius: 16, padding: "5px 8px", cursor: "pointer",
          color: themeMode === mode ? "#fff" : (transparent ? "#999" : t.textMuted),
          display: "flex", alignItems: "center", transition: "all 0.3s ease",
        }}><Icon size={14} /></button>
      ))}
    </div>
  );
}
