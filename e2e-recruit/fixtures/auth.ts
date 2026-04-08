import { test as base, type Page } from '@playwright/test';

/**
 * Injects auth tokens via addInitScript so they're available BEFORE React mounts.
 * This avoids the double-navigation problem (going to /login first to set localStorage).
 */
export async function setupAuth(page: Page) {
  await page.addInitScript(() => {
    // Build a valid JWT that tokenStore.decodeAccessToken() can decode with atob()
    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const payload = JSON.stringify({
      userId: 'test-user-001',
      userType: 'admin',
      permissions: { '*': '*' },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    });
    const token = `${btoa(header)}.${btoa(payload)}.fake-signature`;

    localStorage.setItem('auth_access_token', token);
    localStorage.setItem('auth_refresh_token', 'fake-refresh-token');
    localStorage.setItem('auth_user_id', 'test-user-001');
  });
}

/**
 * Playwright test fixture that provides an authenticated page.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await setupAuth(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
