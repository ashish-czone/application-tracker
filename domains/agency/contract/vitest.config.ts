import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../packages/vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      include: ['**/*.test.ts'],
      globals: false,
    },
  }),
);
