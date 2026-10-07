import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:";

export default defineConfig(({ mode, command }) => ({
  base: './',
  plugins: [
    {
      name: 'vt-csp',
      // a strict Content-Security-Policy for the shipped build (the dev server needs inline HMR)
      transformIndexHtml: (html: string) => (command === 'build' ? html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`) : html),
    },
  ],
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
