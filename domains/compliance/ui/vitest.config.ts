import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../packages/vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      globals: true,
      include: ['**/*.test.ts', '**/*.test.tsx'],
      exclude: ['**/node_modules/**'],
    },
  }),
);
