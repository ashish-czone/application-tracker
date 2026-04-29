import path from 'node:path';
import { defineConfig } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5176';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3012';

const repoRoot = path.resolve(__dirname, '..');

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
  // The suite owns its own server lifecycle so a single `playwright test`
  // invocation is enough — no manual pre-boot, no env flag the developer
  // has to remember.
  //
  // The API runs in non-watch mode (dev:e2e) so filesystem noise during the
  // run cannot trigger Nest rebuilds mid-suite. The watch flag is what
  // produced the spurious `TypeError: fetch failed` failures we saw before.
  //
  // reuseExistingServer is true off-CI so a long-running local dev session
  // (with both servers manually started) still works for fast iteration.
  //
  // stdout is ignored on purpose: the compliance API emits hundreds of
  // INFO log lines at boot (one per registered entity / lookup / resolver)
  // and Playwright's piped stdout buffer fills up before the URL probe
  // succeeds, deadlocking the child. Errors still surface via stderr.
  webServer: [
    {
      // dev:e2e wraps `nest build && node --env-file=.env dist/main` so the
      // server runs from the prebuilt dist (no rebuild while tests are
      // running) with ENABLE_TEST_HOOKS=true.
      command: 'pnpm run dev:e2e',
      cwd: path.join(repoRoot, 'apps/compliance'),
      // Any RBAC-gated GET works — returns 401 once the Nest app is up,
      // which Playwright treats as "ready". `/admin/test/reset` is POST-only
      // so GET to it returns 404, which Playwright treats as "not ready".
      url: `${API_URL}/api/v1/clients`,
      reuseExistingServer: !process.env.CI,
      // Generous timeout to accommodate the cold-start `nest build` step on
      // first run; cached builds are near-instant.
      timeout: 300_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'pnpm run dev',
      cwd: path.join(repoRoot, 'apps/compliance-web'),
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
