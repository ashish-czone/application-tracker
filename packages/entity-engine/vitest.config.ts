import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup-field-types.ts'],
  },
  resolve: {
    alias: {
      '@packages': path.resolve(__dirname, '..'),
    },
  },
});
