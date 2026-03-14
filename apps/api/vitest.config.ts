import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['**/*.test.ts'],
    globalSetup: [path.resolve(__dirname, '../../test/setup/globalSetup.ts')],
    hookTimeout: 30000,
    teardownTimeout: 10000,
    testTimeout: 30000,
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      '@packages': path.resolve(__dirname, '../../packages'),
      '@modules': path.resolve(__dirname, './src/modules'),
    },
  },
});
