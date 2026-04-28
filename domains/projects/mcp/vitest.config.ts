import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../packages/vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      globals: false,
    },
  }),
);
