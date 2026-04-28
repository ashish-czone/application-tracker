import { defineConfig } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5177';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3014';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  globalSetup: './global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  // Real backend with shared DB state — must run serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      'x-e2e-api-url': API_URL,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // CI / local: assume both servers already running.
  // Boot them via `pnpm --filter @apps/agency dev` and the admin portal
  // via `pnpm --filter @apps/agency-admin dev`.
});
