import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['**/*.test.ts'],
    globalSetup: ['./test/setup/globalSetup.ts'],
    teardownTimeout: 10000,
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@packages': path.resolve(__dirname, './packages'),
      '@modules': path.resolve(__dirname, './apps/api/src/modules'),
    },
  },
});
