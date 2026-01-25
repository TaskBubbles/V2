import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are loaded correctly on GitHub Pages subdirectories
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  publicDir: './' // Treat root as public so manifest.json and sw.js are copied
});