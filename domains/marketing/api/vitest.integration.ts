import path from 'node:path';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { buildPackageAliases } from '../../../packages/resolve-aliases';

/**
 * Marketing integration test config. Built directly rather than via
 * mergeConfig so the global-setup runs deterministically. Mirrors the
 * shape projects + compliance use.
 */
const packagesDir = path.resolve(__dirname, '../../../packages');
const testingDir = path.join(packagesDir, 'core/testing');

export default defineConfig({
  test: {
    globals: true,
    root: __dirname,
    include: ['**/*.integration.test.ts'],
    globalSetup: [path.resolve(__dirname, '__tests__/setup/global-setup.ts')],
    setupFiles: [path.join(testingDir, 'setup-env.ts')],
    hookTimeout: 60000,
    teardownTimeout: 10000,
    testTimeout: 30000,
    fileParallelism: false,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
  resolve: {
    alias: buildPackageAliases(packagesDir),
  },
});
