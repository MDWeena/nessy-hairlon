import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// Vercel sets VERCEL_ENV ('production' | 'preview' | 'development') automatically on every
// build — no env var setup needed. Only an actual Production deployment gets the real app
// name; Preview (and local `npm run dev`) install as "Nessy_preprod" so both can be installed
// side by side on a phone and told apart, letting preprod pushes get tested as an installed PWA
// before they reach production.
const isProductionBuild = process.env.VERCEL_ENV === 'production'
const appName = isProductionBuild ? 'Nessy Hairlon' : 'Nessy_preprod'

/** Vite only interpolates %ENV_VAR% placeholders in index.html for VITE_-prefixed vars loaded
 * via loadEnv — VERCEL_ENV isn't one of those (nor should it be exposed to client code), so the
 * apple-mobile-web-app-title meta tag (iOS's equivalent of manifest.short_name) is swapped here
 * instead, at build time. */
function iosAppTitlePlugin() {
  return {
    name: 'ios-app-title',
    transformIndexHtml(html: string) {
      return html.replace(
        /<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/,
        `<meta name="apple-mobile-web-app-title" content="${appName}" />`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    iosAppTitlePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        name: appName,
        short_name: appName,
        description: 'Book your hair styling appointment with Nessy Hairlon',
        theme_color: '#1E1914',
        background_color: '#0A0A0A',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // BUG FIX: this used to be `navigateFallback: '/offline.html'`, which makes the service
        // worker answer EVERY navigation to a path that isn't precached (/track, /book,
        // /admin?booking=…) with the offline page — even with a perfectly good connection. Only
        // "/" escaped, being precached. So any emailed /track or /admin link, or a refresh on
        // those pages, showed "You're currently offline" once the service worker was installed.
        // Navigations now go to the network, and the offline page is only the fallback when the
        // network actually fails.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
            options: { precacheFallback: { fallbackURL: '/offline.html' } },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'cloudinary-images', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
  },
})
