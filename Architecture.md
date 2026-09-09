# Nessy Hairlon — Architecture Spec

## Overview
Hair booking website with client-facing pages and an admin panel.
Built with React + TypeScript. 
The full working prototype is currently in `src/App.tsx` as a single file.
Decompose it into the structure below, preserving all functionality.
All component files must use `.tsx` extension. 
All non-component files (hooks, constants, context) use `.ts` extension.
Add proper TypeScript types/interfaces for all props, state, and data structures.

## File Structure
src/
├── types/
│ └── index.ts # Shared interfaces: Theme, Service, BookingDay, Order, etc.
│
├── assets/
│ └── logos.ts # Export all LOGO_* and HERO_BG base64 constants
│
├── constants/
│ ├── themes.ts # Export the themes object (light + dark), typed with Theme interface
│ ├── services.ts # Export the services array, typed with Service interface
│ ├── scheduleDefaults.ts # Export scheduleDefaults object
│ └── statusColors.ts # Export statusColors object
│
├── context/
│ └── ThemeContext.tsx # ThemeProvider + useTheme hook
│ # Manages: themeMode, resolvedTheme, theme colors (t), isDark
│ # Replaces all prop-drilling of t, isDark, themeMode, setThemeMode
│
├── hooks/
│ ├── useScrollPosition.ts # Returns scrolled boolean (true when scrollY > 420)
│ ├── usePageTransition.ts # Returns { page, navigate, pageLoading }
│ └── useBookingDays.ts # Returns generated booking days array (from getBookingDays function)
│
├── components/
│ ├── layout/
│ │ ├── Navbar.tsx
│ │ ├── MobileDrawer.tsx
│ │ ├── Footer.tsx
│ │ └── WeenaCredit.tsx
│ │
│ ├── ui/
│ │ ├── FadeIn.tsx
│ │ ├── HairMenuIcon.tsx
│ │ ├── ThemeToggle.tsx
│ │ ├── GoldButton.tsx
│ │ ├── OutlineButton.tsx
│ │ └── StatusBadge.tsx
│ │
│ ├── home/
│ │ ├── HeroSection.tsx
│ │ ├── TrustBar.tsx
│ │ ├── WhyNessy.tsx
│ │ ├── HowItWorks.tsx
│ │ ├── Testimonials.tsx
│ │ └── CTASection.tsx
│ │
│ ├── booking/
│ │ ├── ProgressBar.tsx
│ │ ├── StepDateTime.tsx
│ │ ├── StepServices.tsx
│ │ ├── StepReview.tsx
│ │ └── ServiceCard.tsx
│ │
│ ├── loaders/
│ │ ├── ClientLoader.tsx
│ │ └── AdminLoader.tsx
│ │
│ └── admin/
│ ├── AdminSidebar.tsx
│ ├── AdminTopBar.tsx
│ ├── Dashboard.tsx
│ ├── Orders.tsx
│ ├── Availability.tsx
│ ├── ServicesManager.tsx
│ ├── ClientStories.tsx
│ ├── GalleryManager.tsx
│ └── Settings.tsx
│
├── pages/
│ ├── HomePage.tsx
│ ├── ServicesPage.tsx
│ ├── GalleryPage.tsx
│ ├── BookingPage.tsx
│ ├── AdminLogin.tsx
│ └── AdminPanel.tsx
│
├── styles/
│ └── global.css
│
├── App.tsx
└── index.tsx

## TypeScript Guidelines

1. **Create a `types/index.ts`** file with interfaces for:
   - `Theme` — the shape of each theme object (bg, text, gold, surface, etc.)
   - `ThemeMode` — `'light' | 'dark' | 'system'`
   - `ServiceItem` — name, price, priceRange, desc, duration, icon
   - `ServiceCategory` — cat, items
   - `BookingDay` — key, label, slots, slotCount
   - `Order` — id, client, service, date, time, status, price
   - `StatusConfig` — bg, text, label
   - `ScheduleDay` — open, start, end
   - `Story` — id, name, text, stars, visible
   - `NavigateFn` — `(page: string) => void`

2. **All component props must be typed** with interfaces named `[Component]Props`.
   Example: `interface NavbarProps { navigate: NavigateFn; page: string; }`

3. **useTheme hook** should return a typed object:
   `{ themeMode: ThemeMode; setThemeMode: (m: ThemeMode) => void; t: Theme; isDark: boolean; }`

4. **Event handlers** should use proper React types: 
   `React.MouseEvent<HTMLButtonElement>`, `React.ChangeEvent<HTMLInputElement>`, etc.

5. **Icon components from lucide-react** are typed via `LucideIcon` type.

## Key Refactoring Rules

1. **ThemeContext replaces prop drilling.**
   - Create a context that provides: themeMode, setThemeMode, t (theme colors), isDark
   - Every component that needs theme data calls useTheme() instead of receiving props

2. **Navigation state lives in App.tsx** via usePageTransition hook.
   - The hook manages: page, navigate(pageName), pageLoading
   - navigate is passed down or put in context

3. **All base64 images** move to assets/logos.ts as named exports.

4. **All data constants** (services, themes, scheduleDefaults, statusColors, fakeOrders)
   move to constants/ as typed named exports.

5. **CSS animations and media queries** move to styles/global.css.
   Remove inline <style> tags from components. Keep component-specific inline
   styles (they use theme variables so they need to stay dynamic).

6. **Admin state** (isAdmin, adminAuth, adminPage) stays in App.tsx or AdminPanel.tsx.

7. **Preserve every feature exactly.** Don't simplify, don't remove sections,
   don't change styling. Just move code to the right files, add types, and wire imports.

8. **No `any` types.** Type everything properly.