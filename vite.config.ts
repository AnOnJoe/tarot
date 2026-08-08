import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Déployé sur GitHub Pages sous /tarot/ — les chemins doivent être relatifs à cette base.
export default defineConfig({
  base: '/tarot/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // L'enregistrement est fait à la main dans src/pwa.ts, qui ajoute les contrôles de
      // mise à jour dont iOS a besoin. Sans ceci, le script injecté ferait doublon.
      injectRegister: null,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'Tarot — compteur de points',
        short_name: 'Tarot',
        description: 'Compteur de points pour le tarot à 3, 4 et 5 joueurs.',
        lang: 'fr',
        start_url: '/tarot/',
        scope: '/tarot/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0c0e',
        theme_color: '#0b0c0e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
