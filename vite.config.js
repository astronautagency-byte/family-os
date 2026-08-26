import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    target: ['es2018', 'safari13'],
    cssTarget: 'safari13'
  },
  // Force the automatic JSX runtime so vitest uses _jsx from react/jsx-runtime
  // instead of legacy React.createElement — otherwise tests crash with
  // "ReferenceError: React is not defined" at the first JSX site.
  // Lives at the top level because vitest reads vite-level esbuild exactly
  // here, NOT inside the test block.
  esbuild: {
    jsx: 'automatic',
  },
  // Vitest block — augments vite.config.js so vitest reads it directly.
  // Splits the destructive-action component contract tests off the pure-JS
  // node:test suite already in tests/. Disable `vitest` discovery anywhere
  // .freebuff footsteps land today (desktop preview SQLite + log).
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/__tests__/**/*.{test,spec}.{js,jsx}', 'src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', 'dist', '.freebuff', 'tests'],
    css: false,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Version-bust the SW URL on every build so the browser treats the new
      // service worker as a fresh registration rather than waiting for the old
      // one to detect an update. This prevents the stale-SW white screen where
      // an old SW serves cached HTML referencing old asset hashes.
      version: '1.4.1',
      includeAssets: ['icons/famos-app-icon.png', 'icons/famos-mark.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        id: 'https://home.fam-os.app/',
        name: 'FamOS - Families Run Better on FamOS',
        short_name: 'FamOS',
        description: 'Families run better on FamOS—the smart home hub for organizing your family’s days, tasks, meals, groceries, calendars, and more.',
        theme_color: '#B8D8FF',
        background_color: '#FAF9FF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        share_target: {
          action: '/',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: { title: 'shared_title', text: 'shared_text', url: 'shared_url' }
        },
        categories: ['lifestyle', 'productivity'],
        icons: [
          { src: 'icons/famos-app-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/famos-mark.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Precache only the app shell — NOT png/jpg. The marketing images and
        // illustrations were ~38MB of precache, blowing up first-load/install.
        // Images are cached at runtime on first use instead (below).
        globPatterns: [],
        globIgnores: ['**/marketing/ads/**'],
        importScripts: ['/notification-sw.js'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'famos-pages',
              expiration: { maxEntries: 20, maxAgeSeconds: 3600 }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'famos-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'famos-images',
              expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})
