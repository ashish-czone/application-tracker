import { createViTestIntegrationConfig } from '../../core/testing/vitest-integration';
import { defineConfig } from 'vitest/config';

export default createViTestIntegrationConfig(__dirname, defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/recruit',
    },
  },
}));
