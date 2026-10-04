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
  const { themeMode, setThemeMode } = useTheme();

  if (variant === "labeled") {
    return (
      <div className="flex gap-2">
        {OPTIONS.map(({ mode, Icon, label }) => (
          <button
            key={mode} onClick={() => setThemeMode(mode)}
            className={`flex-1 p-2.5 rounded-lg cursor-pointer border text-xs flex flex-col items-center gap-1 ${
              themeMode === mode ? "bg-gold-bg border-gold text-gold font-bold" : "bg-surface border-border text-text-soft font-normal"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="flex bg-bg-alt rounded-lg p-[3px]">
        {OPTIONS.map(({ mode, Icon }) => (
          <button
            key={mode} onClick={() => setThemeMode(mode)}
            className={`flex-1 border-none rounded-md p-1.5 cursor-pointer flex items-center justify-center [transition:all_0.2s] ${
              themeMode === mode ? "bg-gold text-white" : "bg-transparent text-text-muted"
            }`}
          ><Icon size={14} /></button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex rounded-[20px] p-[3px] border ${transparent ? "bg-white/10 border-white/15" : "bg-bg-alt border-border"} ${spaced ? "ml-2 [transition:all_0.4s_ease]" : ""}`}>
      {OPTIONS.map(({ mode, Icon }) => (
        <button
          key={mode} onClick={() => setThemeMode(mode)}
          className={`border-none rounded-2xl py-[5px] px-2 cursor-pointer flex items-center [transition:all_0.3s_ease] ${
            themeMode === mode ? "bg-gold text-white" : `bg-transparent ${transparent ? "text-[#999]" : "text-text-muted"}`
          }`}
        ><Icon size={14} /></button>
      ))}
    </div>
  );
}
