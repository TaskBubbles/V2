import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg'],
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        name: 'Task Bubbles',
        short_name: 'Task Bubbles',
        description: 'A physics-based, interactive task management tool.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        launch_handler: {
          client_mode: 'focus-existing'
        },
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: "New Task",
            short_name: "Add",
            description: "Create a new task bubble",
            url: "./",
            icons: [{ src: "favicon.svg", sizes: "192x192", type: "image/svg+xml" }]
          }
        ]
      }
    })
  ],
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});