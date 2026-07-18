import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    target: ['es2018', 'safari13'],
    cssTarget: 'safari13'
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        id: 'https://fam-os.app/',
        name: 'FamOS - Families Run Better on FamOS',
        short_name: 'FamOS',
        description: 'Families run better on FamOS—the smart home hub for organizing your family’s days, tasks, meals, groceries, calendars, and more.',
        theme_color: '#B8D8FF',
        background_color: '#FAF9FF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['lifestyle', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['**/marketing/ads/**'],
        importScripts: ['/notification-sw.js']
      }
    })
  ]
})
