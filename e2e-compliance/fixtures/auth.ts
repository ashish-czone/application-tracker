import { test as base, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const AUTH_FILE = path.join(__dirname, '..', '.auth', 'admin.json');

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

/** Read tokens written by globalSetup. Throws if globalSetup didn't run. */
export function readStoredTokens(): StoredTokens {
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error(
      `Auth file missing at ${AUTH_FILE}. globalSetup must run first — ensure playwright.config.ts has globalSetup configured.`,
    );
  }
  return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
}

/**
 * Inject auth tokens into localStorage BEFORE the React app boots.
 * Mirrors how the real frontend hydrates from tokenStore on first paint.
 *
 * Also injects CSS that hides the dev DebugProfilerBar (a `fixed bottom-3
 * right-3 z-[9999]` element from `@packages/debug-profiler-ui`) — it
 * intercepts pointer events on bottom-right buttons during tests, and
 * is gated only by `import.meta.env.DEV` so we can't disable it via env.
 */
export async function setupAuth(page: Page): Promise<void> {
  const tokens = readStoredTokens();
  await page.addInitScript((t) => {
    localStorage.setItem('auth_access_token', t.accessToken);
    localStorage.setItem('auth_refresh_token', t.refreshToken);
    localStorage.setItem('auth_user_id', t.userId);
  }, tokens);

  await page.addInitScript(() => {
    const id = '__e2e-hide-debug-profiler__';
    const inject = () => {
      if (document.getElementById(id)) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = '.fixed.z-\\[9999\\] { display: none !important; }';
      document.head.appendChild(style);
    };
    if (document.head) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  });
}

/** Test fixture providing an already-authenticated page. */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await setupAuth(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
