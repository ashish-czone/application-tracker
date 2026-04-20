import { defineConfig, mergeConfig, type UserConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';
import { buildPackageAliases } from '../../resolve-aliases';

/**
 * Creates a vitest config for package-level integration tests.
 *
 * - Includes SWC plugin for NestJS decorator support
 * - Sets up package aliases
 * - Runs DB migrations via globalSetup
 * - Disables file parallelism (shared DB state)
 * - Only matches *.integration.test.ts files
 *
 * Usage in vitest.integration.ts:
 *   import { createViTestIntegrationConfig } from '@packages/testing';
 *   export default createViTestIntegrationConfig(__dirname);
 */
export function createViTestIntegrationConfig(packageDir: string, overrides?: UserConfig) {
  // packagesDir must resolve to the repo's `packages/` root regardless of how
  // deeply nested the caller sits (e.g. `packages/addons/<name>/api/` vs
  // `packages/addons/<name>/`). Anchor on __dirname of this helper rather than
  // the caller's path — this file lives at `packages/core/testing/`, so
  // `../..` is always `packages/`.
  const packagesDir = path.resolve(__dirname, '../..');

  const base = defineConfig({
    test: {
      globals: true,
      root: packageDir,
      include: ['**/*.integration.test.ts'],
      globalSetup: [path.resolve(__dirname, 'global-setup.ts')],
      setupFiles: [path.resolve(__dirname, 'setup-env.ts')],
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
      alias: buildPackageAliases(packagesDir),
    },
  });

  return overrides ? mergeConfig(base, overrides) : base;
}
