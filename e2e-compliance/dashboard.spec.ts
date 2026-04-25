import { test, expect } from './fixtures/auth';

test.describe('Dashboard', () => {
  test('page renders heading and at least the four configured widgets', async ({
    authedPage,
  }) => {
    await authedPage.goto('/dashboard');
    await expect(authedPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Widget headings (from compliance + notifications + tasks contributions).
    await expect(authedPage.getByText(/overdue filings/i).first()).toBeVisible();
    await expect(authedPage.getByText(/upcoming filings/i).first()).toBeVisible();
    await expect(authedPage.getByText(/my tasks/i).first()).toBeVisible();
    await expect(authedPage.getByText(/notifications|recent activity/i).first()).toBeVisible();
  });

  test('export and new filing buttons are visible', async ({ authedPage }) => {
    await authedPage.goto('/dashboard');
    await expect(authedPage.getByRole('button', { name: /^Export$/ })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /New filing/i })).toBeVisible();
  });
});
