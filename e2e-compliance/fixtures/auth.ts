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
 */
export async function setupAuth(page: Page): Promise<void> {
  const tokens = readStoredTokens();
  await page.addInitScript((t) => {
    localStorage.setItem('auth_access_token', t.accessToken);
    localStorage.setItem('auth_refresh_token', t.refreshToken);
    localStorage.setItem('auth_user_id', t.userId);
  }, tokens);
}

/** Test fixture providing an already-authenticated page. */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await setupAuth(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
