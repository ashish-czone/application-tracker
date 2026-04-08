import { test, expect } from '@playwright/test';
import { setupAllMocks, MOCK_DATA } from './fixtures/setup';

test.describe('Offers', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  // ---------------------------------------------------------------------------
  // List Page
  // ---------------------------------------------------------------------------

  test.describe('List page', () => {
    test('should display page heading and add button', async ({ page }) => {
      await page.goto('/offers');
      await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Offer' })).toBeVisible();
    });

    test('should display offers in the data grid', async ({ page }) => {
      await page.goto('/offers');
      const first = MOCK_DATA.offers[MOCK_DATA.offers.length - 1];
      await expect(page.locator('table').getByText(first.applicationId__label).first()).toBeVisible();
    });

    test('should show pagination info', async ({ page }) => {
      await page.goto('/offers');
      await expect(page.getByText(/Showing .* to .* of .* results/)).toBeVisible();
    });

    test('should sort by status column', async ({ page }) => {
      await page.goto('/offers');
      await page.locator('th').getByText('Status').click();
      await expect(page).toHaveURL(/sort=status/);
    });

    test('should navigate to next page', async ({ page }) => {
      await page.goto('/offers');
      await page.getByLabel('Next page').click();
      await expect(page).toHaveURL(/page=2/);
    });

    test('should navigate to detail on application click', async ({ page }) => {
      await page.goto('/offers');
      const first = MOCK_DATA.offers[MOCK_DATA.offers.length - 1];
      await page.locator('table').getByText(first.applicationId__label).first().click();
      await expect(page).toHaveURL(new RegExp(`/offers/${first.id}`));
    });
  });

  // ---------------------------------------------------------------------------
  // Quick Create
  // ---------------------------------------------------------------------------

  test.describe('Quick create', () => {
    test('should open quick create modal', async ({ page }) => {
      await page.goto('/offers');
      await page.getByRole('button', { name: 'Add Offer' }).click();
      await expect(page.getByRole('heading', { name: 'Add Offer' })).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Detail Page
  // ---------------------------------------------------------------------------

  test.describe('Detail page', () => {
    test('should display offer info', async ({ page }) => {
      const offer = MOCK_DATA.offers[0];
      await page.goto(`/offers/${offer.id}`);
      await expect(page.getByText(offer.applicationId__label).first()).toBeVisible();
    });

    test('should display compensation section', async ({ page }) => {
      const offer = MOCK_DATA.offers[0];
      await page.goto(`/offers/${offer.id}`);
      await expect(page.getByText('Compensation')).toBeVisible();
    });

    test('should display timeline section', async ({ page }) => {
      const offer = MOCK_DATA.offers[0];
      await page.goto(`/offers/${offer.id}`);
      await expect(page.getByText('Timeline')).toBeVisible();
    });

    test('should navigate back to list', async ({ page }) => {
      const offer = MOCK_DATA.offers[0];
      await page.goto(`/offers/${offer.id}`);
      const backLink = page.locator('a, button').filter({ hasText: 'Offers' }).first();
      await backLink.click();
      await expect(page).toHaveURL('/offers');
    });
  });
});
