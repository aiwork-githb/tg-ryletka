import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  define: { __DEBUG__: 'true' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
