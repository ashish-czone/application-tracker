import { defineConfig } from 'vitest/config';
import path from 'path';
import { buildPackageAliases } from '../../../resolve-aliases';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['**/*.integration.test.ts'],
    globalSetup: ['../../../../test/setup/globalSetup.ts'],
    hookTimeout: 30000,
    teardownTimeout: 10000,
    testTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: buildPackageAliases(path.resolve(__dirname, '../../../')),
  },
});
