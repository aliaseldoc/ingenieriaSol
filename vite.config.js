import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages (repo de proyecto, no de usuario/org) sirve bajo una subruta
// con el nombre del repo; Vercel sirve siempre en la raiz del dominio y
// define la variable VERCEL automaticamente durante el build. Se soportan
// ambos destinos con el mismo codigo mientras conviven las dos formas de
// despliegue. Se define una sola vez y se reusa en el manifest para que
// nunca queden desincronizados.
const BASE_PATH = process.env.VERCEL
  ? '/'
  : `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'ingenieria-sol-service-portal'}/`

// https://vite.dev/config/
export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        start_url: BASE_PATH,
        scope: BASE_PATH,
        name: 'Ingeniería Sol · Portal de Operaciones',
        short_name: 'Ingeniería Sol',
        description: 'Gestión de visitas técnicas a grupos electrógenos.',
        lang: 'es',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f2f2ef',
        theme_color: '#1f4a3d',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Resuelve rutas como /tecnico/visita/:id sin conexion, sin depender
        // del truco 404.html que usa el deploy de GitHub Pages.
        navigateFallback: `${BASE_PATH}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Sin esto se pierden los icons (material-symbols-outlined) y las
          // tipografias durante horas de uso offline en el campo.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Explicito y redundante a proposito: el service worker ya no
          // intercepta Supabase sin esta regla (generateSW solo precachea el
          // app shell), pero dejarla documenta la decision de que los datos
          // de dominio viven en IndexedDB, manejados por la app, nunca en la
          // cache del service worker.
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      // El service worker no se comporta bien con vite dev/HMR: se prueba
      // siempre sobre `npm run build && npm run preview`.
      devOptions: { enabled: false },
    }),
  ],
})
