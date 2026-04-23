import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'node:path';
import { buildPackageAliases } from '../../../packages/resolve-aliases';

const workspaceRoot = path.resolve(__dirname, '../../..');
const packagesDir = path.join(workspaceRoot, 'packages');

export default defineConfig({
  test: {
    globals: true,
    root: __dirname,
    include: ['**/*.integration.test.ts'],
    globalSetup: [path.resolve(__dirname, 'test/global-setup.ts')],
    setupFiles: [path.resolve(workspaceRoot, 'packages/core/testing/setup-env.ts')],
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
    alias: {
      ...buildPackageAliases(packagesDir),
      '@domains/agency-contract': path.resolve(workspaceRoot, 'domains/agency/contract'),
    },
  },
});
