import type { Theme } from "../types";

export const themes: { light: Theme; dark: Theme } = {
  light: {
    bg: "#FFFCF8", bgAlt: "#F0E6D8", surface: "#F5EDE3", surfaceHover: "#EDE3D5",
    text: "#120D04", textSoft: "#4A3D2E", textMuted: "#8B7A64",
    gold: "#C49A6C", goldDark: "#A67B4F", goldLight: "#E8D5BF", goldBg: "#C49A6C15",
    border: "#DDD2C2", borderStrong: "#C9BBAA",
    black: "#0A0A0A", white: "#FFFFFF",
    navBg: "rgba(255,252,248,0.85)", shadow: "0 1px 3px rgba(26,18,7,0.06)",
    heroOverlay: "linear-gradient(135deg, rgba(10,10,10,0.82) 0%, rgba(42,26,14,0.7) 100%)",
    cardShadow: "0 3px 12px rgba(26,18,7,0.12), 0 1px 3px rgba(26,18,7,0.08)",
  },
  dark: {
    bg: "#0E0B08", bgAlt: "#1A1510", surface: "#1E1914", surfaceHover: "#2A241D",
    text: "#F0E8DC", textSoft: "#B8A994", textMuted: "#7A6E5E",
    gold: "#C49A6C", goldDark: "#D4B896", goldLight: "#3D2E1F", goldBg: "#C49A6C18",
    border: "#2E271E", borderStrong: "#3D3428",
    black: "#0A0A0A", white: "#F0E8DC",
    navBg: "rgba(14,11,8,0.9)", shadow: "0 1px 3px rgba(0,0,0,0.3)",
    heroOverlay: "linear-gradient(135deg, rgba(10,10,10,0.88) 0%, rgba(42,26,14,0.8) 100%)",
    cardShadow: "0 2px 16px rgba(0,0,0,0.2)",
  },
};
