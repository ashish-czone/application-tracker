import { test, expect } from './fixtures/auth';
import { resetState } from './helpers';

test.describe('Smoke', () => {
  test.beforeAll(async () => {
    await resetState();
  });

  test('logs in as e2e-admin and lands on dashboard', async ({ authedPage }) => {
    await authedPage.goto('/');
    // Auth fixture injected tokens; root redirects to /dashboard for authed users.
    await authedPage.waitForURL(/\/dashboard/);
    await expect(authedPage.getByRole('heading', { name: /dashboard/i }).first()).toBeVisible();
  });

  test('main nav exposes the projects domain sections', async ({ authedPage }) => {
    await authedPage.goto('/dashboard');
    // Sidebar items proving the WebShell mounted with the projects manifest.
    await expect(authedPage.getByRole('link', { name: /^Projects$/ }).first()).toBeVisible();
    await expect(authedPage.getByRole('link', { name: /^My Tasks$/ }).first()).toBeVisible();
  });

  test('projects dashboard renders the empty state on a clean DB', async ({ authedPage }) => {
    await authedPage.goto('/projects');
    await expect(authedPage.getByRole('heading', { name: /projects/i }).first()).toBeVisible();
    // EmptyState renders an editorial quote when no projects exist (see
    // ProjectsDashboardPage). Match a stable substring of that quote.
    await expect(authedPage.getByText(/list of intentions/i)).toBeVisible();
  });
});
