import { test, expect } from '@playwright/test';
import { setupAllMocks, MOCK_DATA } from './fixtures/setup';

test.describe('Interviews', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  // ---------------------------------------------------------------------------
  // List Page
  // ---------------------------------------------------------------------------

  test.describe('List page', () => {
    test('should display page heading and add button', async ({ page }) => {
      await page.goto('/interviews');
      await expect(page.getByRole('heading', { name: 'Interviews' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Interview' })).toBeVisible();
    });

    test('should display interviews in the data grid', async ({ page }) => {
      await page.goto('/interviews');
      const first = MOCK_DATA.interviews[MOCK_DATA.interviews.length - 1];
      await expect(page.locator('table').getByText(first.interviewName).first()).toBeVisible();
    });

    test('should show candidate lookup labels', async ({ page }) => {
      await page.goto('/interviews');
      const first = MOCK_DATA.interviews[MOCK_DATA.interviews.length - 1];
      await expect(page.locator('table').getByText(first.candidateId__label).first()).toBeVisible();
    });

    test('should filter by search', async ({ page }) => {
      await page.goto('/interviews');
      await page.getByPlaceholder('Search interviews...').fill('Interview 1');
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/search=Interview/);
    });

    test('should sort by interview name', async ({ page }) => {
      await page.goto('/interviews');
      await page.locator('th').getByText('Interview Name').click();
      await expect(page).toHaveURL(/sort=interviewName/);
    });

    test('should navigate to detail on name click', async ({ page }) => {
      await page.goto('/interviews');
      const first = MOCK_DATA.interviews[MOCK_DATA.interviews.length - 1];
      await page.locator('table').getByText(first.interviewName).first().click();
      await expect(page).toHaveURL(new RegExp(`/interviews/${first.id}`));
    });

    test('should show empty state when no results', async ({ page }) => {
      await page.goto('/interviews');
      await page.getByPlaceholder('Search interviews...').fill('zzzznonexistent');
      await page.waitForTimeout(500);
      await expect(page.getByText('No interviews yet')).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Quick Create
  // ---------------------------------------------------------------------------

  test.describe('Quick create', () => {
    test('should open quick create modal', async ({ page }) => {
      await page.goto('/interviews');
      await page.getByRole('button', { name: 'Add Interview' }).click();
      await expect(page.getByRole('heading', { name: 'Add Interview' })).toBeVisible();
    });

    test('should show interview name field', async ({ page }) => {
      await page.goto('/interviews');
      await page.getByRole('button', { name: 'Add Interview' }).click();
      await expect(page.getByLabel('Interview Name')).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Detail Page
  // ---------------------------------------------------------------------------

  test.describe('Detail page', () => {
    test('should display interview name', async ({ page }) => {
      const interview = MOCK_DATA.interviews[0];
      await page.goto(`/interviews/${interview.id}`);
      await expect(page.getByText(interview.interviewName).first()).toBeVisible();
    });

    test('should display sections', async ({ page }) => {
      const interview = MOCK_DATA.interviews[0];
      await page.goto(`/interviews/${interview.id}`);
      await expect(page.getByText('Interview Information')).toBeVisible();
    });

    test('should navigate back to list', async ({ page }) => {
      const interview = MOCK_DATA.interviews[0];
      await page.goto(`/interviews/${interview.id}`);
      const backLink = page.locator('a, button').filter({ hasText: 'Interviews' }).first();
      await backLink.click();
      await expect(page).toHaveURL('/interviews');
    });
  });
});
