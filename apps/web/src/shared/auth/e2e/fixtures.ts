import { test as base, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'Admin1234';

export async function login(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('/', { timeout: 15_000, waitUntil: 'domcontentloaded' });
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
