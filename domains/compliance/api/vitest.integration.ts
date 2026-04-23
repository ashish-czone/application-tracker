import path from 'node:path';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { buildPackageAliases } from '../../../packages/resolve-aliases';

/**
 * Compliance integration test config. Built directly rather than via
 * `createViTestIntegrationConfig` because vitest's `mergeConfig` concatenates
 * array fields (including `globalSetup`) — so overriding isn't possible, both
 * setups would run. Compliance needs a custom migrator that covers the full
 * platform + compliance chain (see `__tests__/setup/global-setup.ts`).
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
