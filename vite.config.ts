import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pricebook',
        short_name: 'Pricebook',
        description: 'Your cheapest store for every grocery item, offline.',
        start_url: './',
        scope: './',
        display: 'standalone',
        // Android paints system bars and the window behind them from these; the page's
        // theme-color meta tags switch the status bar for light mode at runtime.
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  // `npx wrangler dev` serves the Worker on 8787; the dev server forwards the API to it.
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
