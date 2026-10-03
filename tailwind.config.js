/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme tokens — wired to CSS custom properties set reactively by ThemeContext
        // (see src/context/ThemeContext.tsx), so these classes work correctly in both
        // light and dark mode without needing Tailwind's separate dark: variant.
        bg: "var(--bg)",
        "bg-alt": "var(--bg-alt)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        text: "var(--text)",
        "text-soft": "var(--text-soft)",
        "text-muted": "var(--text-muted)",
        gold: "var(--gold)",
        "gold-dark": "var(--gold-dark)",
        "gold-light": "var(--gold-light)",
        "gold-bg": "var(--gold-bg)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "theme-black": "var(--black)",
        "theme-white": "var(--white)",
        "nav-bg": "var(--nav-bg)",
      },
      boxShadow: {
        theme: "var(--shadow)",
        card: "var(--card-shadow)",
      },
      backgroundImage: {
        "hero-overlay": "var(--hero-overlay)",
      },
      fontFamily: {
        cursive: ["Tangerine", "cursive"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
