import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  define: {
    // Debug tools are compiled out of release builds.
    __DEBUG__: JSON.stringify(mode !== 'production'),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5173, host: true },
}));
