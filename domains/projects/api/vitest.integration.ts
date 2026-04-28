import path from 'node:path';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { buildPackageAliases } from '../../../packages/resolve-aliases';

/**
 * Projects integration test config. Built directly rather than via
 * `mergeConfig` because vitest's merge concatenates array fields including
 * `globalSetup`, so overriding isn't possible — both setups would run.
 * Projects needs its own migrator in `__tests__/setup/global-setup.ts`.
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
    // Single worker — every test file boots its own Nest app and beforeEach
    // truncates the shared DB. Multiple worker threads would interleave
    // truncate + seed across files and produce FK violations.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: buildPackageAliases(packagesDir),
  },
});
