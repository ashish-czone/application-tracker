import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['**/*.test.ts'],
    globalSetup: ['./test/setup/globalSetup.ts'],
    hookTimeout: 30000,
    teardownTimeout: 10000,
    testTimeout: 30000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      '@packages': path.resolve(__dirname, './packages'),
      '@modules': path.resolve(__dirname, './apps/api/src/modules'),
    },
  },
});
