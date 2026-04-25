import { test, expect } from './fixtures/auth';

test.describe('Smoke', () => {
  test('logs in as e2e-admin and lands on dashboard', async ({ authedPage }) => {
    await authedPage.goto('/');
    // Auth fixture injected tokens; root redirects to /dashboard for authed users.
    await authedPage.waitForURL(/\/dashboard/);
    await expect(authedPage.getByRole('heading', { name: /dashboard/i }).first()).toBeVisible();
  });

  test('main nav exposes the core compliance sections', async ({ authedPage }) => {
    await authedPage.goto('/dashboard');
    // Sidebar items proving the WebShell mounted with the compliance manifest.
    await expect(authedPage.getByRole('link', { name: 'Clients' }).first()).toBeVisible();
    await expect(authedPage.getByRole('link', { name: /^Laws$/ }).first()).toBeVisible();
    await expect(authedPage.getByRole('link', { name: /Filings/i }).first()).toBeVisible();
  });
});
