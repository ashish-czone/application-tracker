import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      include: ['**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
      globals: false,
    },
  }),
);
