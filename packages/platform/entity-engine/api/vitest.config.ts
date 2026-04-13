import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../vitest.shared';

export default mergeConfig(shared, defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup-field-types.ts'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
  },
}));
