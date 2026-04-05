import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@packages': path.resolve(__dirname, '..'),
    },
  },
});
