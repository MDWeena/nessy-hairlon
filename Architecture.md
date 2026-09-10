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

## Backend Stack

- **Supabase** — Auth, database (Postgres), row-level security
- **Cloudinary** — Image uploads (client-side unsigned upload)
- **Resend** — Transactional emails (booking confirmations, status changes)
- **Vercel** — Hosting + serverless API routes for backend logic

## Environment Variables
All keys are in `.env`. Variables prefixed with `VITE_` are exposed to the client.
Server-only keys (SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY) are used only in Vercel serverless functions.

## New Files to Create

### src/lib/supabase.ts
- Export a typed Supabase client using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Use Database types from src/types/database.ts

### src/types/database.ts
- TypeScript types matching the Supabase schema below
- Export a Database type for use with createClient<Database>()

### src/lib/cloudinary.ts
- Helper function for unsigned image uploads using VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET
- Returns the uploaded image URL

### api/send-notification.ts
- Vercel serverless function
- Sends emails via Resend using RESEND_API_KEY
- Handles: new booking notification to admin, status change emails to clients

## Supabase Schema

### Tables:

**services**
- id: uuid (PK, default gen_random_uuid())
- category: text (e.g. "Styling", "Treatments")
- name: text
- description: text
- duration: text
- price: text | null (fixed price like "₦8,000")
- price_range_min: integer | null (e.g. 15000)
- price_range_max: integer | null (e.g. 45000)
- icon_name: text (lucide icon name like "Sparkles" or "Heart")
- sort_order: integer
- created_at: timestamptz (default now())

**schedule_defaults**
- id: uuid (PK, default gen_random_uuid())
- day_key: text (Mon, Tue, Wed, Thu, Fri, Sat, Sun) UNIQUE
- is_open: boolean
- start_hour: integer
- end_hour: integer

**blocked_slots**
- id: uuid (PK, default gen_random_uuid())
- date: date
- hour: integer | null (null means entire day is blocked)
- reason: text | null
- created_at: timestamptz (default now())

**bookings**
- id: uuid (PK, default gen_random_uuid())
- client_name: text NOT NULL
- client_phone: text NOT NULL
- client_email: text | null
- booking_date: date NOT NULL
- booking_time: text NOT NULL (e.g. "9:00 AM")
- service_ids: uuid[] (array of service IDs)
- custom_style_url: text | null (Cloudinary URL if they uploaded a photo)
- custom_style_description: text | null
- status: text NOT NULL DEFAULT 'pending_review' (pending_review, quoted, confirmed, completed, cancelled)
- quoted_price: integer | null (in Naira, set by admin for custom quotes)
- notes: text | null
- created_at: timestamptz (default now())
- updated_at: timestamptz (default now())

**testimonials**
- id: uuid (PK, default gen_random_uuid())
- client_name: text NOT NULL
- review_text: text NOT NULL
- stars: integer NOT NULL (1-5)
- is_visible: boolean DEFAULT true
- sort_order: integer DEFAULT 0
- created_at: timestamptz (default now())

**gallery**
- id: uuid (PK, default gen_random_uuid())
- day_of_week: text UNIQUE (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
- style_name: text NOT NULL
- image_url: text | null (Cloudinary URL)
- updated_at: timestamptz (default now())

**settings**
- id: uuid (PK, default gen_random_uuid())
- key: text UNIQUE NOT NULL
- value: jsonb NOT NULL

### Row-Level Security Policies:

- **services**: SELECT for anon, ALL for authenticated
- **schedule_defaults**: SELECT for anon, ALL for authenticated
- **blocked_slots**: SELECT for anon, ALL for authenticated
- **bookings**: SELECT + INSERT for anon, ALL for authenticated
- **testimonials**: SELECT (where is_visible = true) for anon, ALL for authenticated
- **gallery**: SELECT for anon, ALL for authenticated
- **settings**: SELECT for anon, ALL for authenticated

### Seed Data:

Populate from the existing hardcoded constants in the codebase:

**services** — from the `services` array in constants/services.ts:
- Styling category: Braiding, Locs, Crotcheting, Fixing, Wigging (all with price ranges)
- Treatments category: Natural Hair Treatment, Washing, Deep Conditioning, Hot Oil Treatment, Protein Treatment (all with fixed prices)

**schedule_defaults** — from `scheduleDefaults` in constants/scheduleDefaults.ts:
- Mon: open 9-17, Tue: open 9-16, Wed: open 9-17, Thu: open 10-16, Fri: open 9-16, Sat: open 10-15, Sun: closed

**testimonials** — the 3 existing reviews (Amara O., Chidinma E., Bola A.)

**gallery** — 7 entries for each day with style names (Goddess Locs, Knotless Braids, etc.), no images yet

**settings** — seed with:
- business_name: "Nessy Hairlon"
- phone: "0816 127 1343"
- instagram: "@nessy_hairlon"
- bank_name: "GTBank"
- account_number: "012 345 6789"
- account_name: "Nessy Hairlon"
- deposit_percentage: 50
- slot_duration_minutes: 60
- min_booking_notice_hours: 24

### Admin Auth:
- Create an admin user in Supabase Auth with email/password
- AdminLogin.tsx uses supabase.auth.signInWithPassword()
- Admin session persisted via Supabase Auth session management
- All admin pages check for authenticated session

## Data Flow (replace all hardcoded data):

1. **ServicesPage.tsx + BookingPage.tsx** → fetch from `services` table
2. **BookingPage.tsx date/time picker** → fetch `schedule_defaults` + `blocked_slots`, compute available slots
3. **BookingPage.tsx submission** → INSERT into `bookings` + call api/send-notification.ts
4. **Admin Orders.tsx** → read/update `bookings` table
5. **Admin ServicesManager.tsx** → CRUD on `services` table
6. **Admin Availability.tsx** → read `schedule_defaults`, CRUD `blocked_slots`
7. **Admin ClientStories.tsx** → CRUD on `testimonials` table
8. **Admin GalleryManager.tsx** → CRUD on `gallery` table + Cloudinary upload
9. **Admin Settings.tsx** → CRUD on `settings` table
10. **HomePage.tsx testimonials section** → fetch visible testimonials
11. **GalleryPage.tsx** → fetch from `gallery` table

## Hooks to Create

### src/hooks/useServices.ts
- Fetches services from Supabase, returns { services, loading, error }

### src/hooks/useAvailability.ts
- Fetches schedule_defaults + blocked_slots, computes available booking days/slots

### src/hooks/useBookings.ts (admin)
- Fetches bookings, provides updateBookingStatus, setQuotedPrice

### src/hooks/useTestimonials.ts
- Fetches testimonials (public: visible only, admin: all), provides CRUD

### src/hooks/useGallery.ts
- Fetches gallery entries, provides update with Cloudinary upload

### src/hooks/useSettings.ts
- Fetches settings, provides update

### src/hooks/useAuth.ts
- Wraps Supabase Auth: signIn, signOut, session, isAuthenticated