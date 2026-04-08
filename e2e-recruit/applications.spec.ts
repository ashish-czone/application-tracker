import { test, expect } from '@playwright/test';
import { setupAllMocks, MOCK_DATA } from './fixtures/setup';

test.describe('Applications', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  // ---------------------------------------------------------------------------
  // List Page
  // ---------------------------------------------------------------------------

  test.describe('List page', () => {
    test('should display page heading and add button', async ({ page }) => {
      await page.goto('/applications');
      await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Application' })).toBeVisible();
    });

    test('should display applications with lookup labels', async ({ page }) => {
      await page.goto('/applications');
      const first = MOCK_DATA.applications[MOCK_DATA.applications.length - 1];
      // Candidate and Job Opening show as resolved lookup labels
      await expect(page.locator('table').getByText(first.candidateId__label).first()).toBeVisible();
      await expect(page.locator('table').getByText(first.jobOpeningId__label).first()).toBeVisible();
    });

    test('should show pagination info', async ({ page }) => {
      await page.goto('/applications');
      await expect(page.getByText(/Showing .* to .* of .* results/)).toBeVisible();
    });

    test('should sort by stage column', async ({ page }) => {
      await page.goto('/applications');
      await page.locator('th').getByText('Stage').click();
      await expect(page).toHaveURL(/sort=stage/);
    });

    test('should navigate to next page', async ({ page }) => {
      await page.goto('/applications');
      await page.getByLabel('Next page').click();
      await expect(page).toHaveURL(/page=2/);
    });

    test('should navigate to detail on candidate name click', async ({ page }) => {
      await page.goto('/applications');
      const first = MOCK_DATA.applications[MOCK_DATA.applications.length - 1];
      await page.locator('table').getByText(first.candidateId__label).first().click();
      await expect(page).toHaveURL(new RegExp(`/applications/${first.id}`));
    });
  });

  // ---------------------------------------------------------------------------
  // Quick Create
  // ---------------------------------------------------------------------------

  test.describe('Quick create', () => {
    test('should open quick create modal', async ({ page }) => {
      await page.goto('/applications');
      await page.getByRole('button', { name: 'Add Application' }).click();
      await expect(page.getByRole('heading', { name: 'Add Application' })).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Detail Page (ApplicationDetailPage)
  // ---------------------------------------------------------------------------

  test.describe('Detail page', () => {
    test('should display application info', async ({ page }) => {
      const app = MOCK_DATA.applications[0];
      await page.goto(`/applications/${app.id}`);
      // Application name is composed of candidate + job opening labels
      await expect(page.getByText(app.candidateId__label).first()).toBeVisible();
    });

    test('should show back link to applications list', async ({ page }) => {
      const app = MOCK_DATA.applications[0];
      await page.goto(`/applications/${app.id}`);
      await expect(page.getByText('Applications').first()).toBeVisible();
    });

    test('should display sections', async ({ page }) => {
      const app = MOCK_DATA.applications[0];
      await page.goto(`/applications/${app.id}`);
      await expect(page.getByText('Basic Info')).toBeVisible();
    });

    test('should navigate back to list', async ({ page }) => {
      const app = MOCK_DATA.applications[0];
      await page.goto(`/applications/${app.id}`);
      const backLink = page.locator('a, button').filter({ hasText: 'Applications' }).first();
      await backLink.click();
      await expect(page).toHaveURL('/applications');
    });
  });
});
