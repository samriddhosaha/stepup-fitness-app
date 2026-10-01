import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // `ANALYZE=1 npm run build` writes dist/stats.html to see what is in each chunk
    ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.html', gzipSize: true })] : []),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'StepUp',
        short_name: 'StepUp',
        description: 'A personal trainer that lives in your phone.',
        theme_color: '#ECF3F7',
        background_color: '#ECF3F7',
        display: 'standalone',
        id: '/',
        scope: '/',
        lang: 'en',
        categories: ['health', 'fitness', 'lifestyle'],
        start_url: '/dashboard',
        shortcuts: [
          { name: 'Start workout', short_name: 'Workout', url: '/workout', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Log body weight', short_name: 'Weight', url: '/progress', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Latin fonts only are precached; other scripts load on demand if ever needed.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}', '**/*latin*.woff2'],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: ['src/lib/**/*.test.{ts,tsx}'],
      thresholds: { lines: 80, statements: 80 },
    },
  },
})
