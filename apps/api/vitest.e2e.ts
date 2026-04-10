import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';
import { buildPackageAliases } from '../../packages/resolve-aliases';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['**/*.e2e.test.ts', '**/*.security.test.ts'],
    globalSetup: [path.resolve(__dirname, '../../test/setup/globalSetup.ts')],
    setupFiles: [path.resolve(__dirname, './test-setup-env.ts')],
    hookTimeout: 60000,
    teardownTimeout: 15000,
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
      ...buildPackageAliases(path.resolve(__dirname, '../../packages')),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@test': path.resolve(__dirname, '../../test'),
    },
  },
});
