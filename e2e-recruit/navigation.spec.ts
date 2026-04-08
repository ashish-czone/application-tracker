import { test, expect } from '@playwright/test';
import { setupAllMocks } from './fixtures/setup';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test('should load the dashboard at root URL', async ({ page }) => {
    await page.goto('/');
    // Dashboard should be the landing page
    await expect(page).toHaveURL('/');
  });

  test('should navigate to candidates page', async ({ page }) => {
    await page.goto('/candidates');
    await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible();
  });

  test('should navigate to job openings page', async ({ page }) => {
    await page.goto('/job-openings');
    await expect(page.getByRole('heading', { name: 'Job Openings' })).toBeVisible();
  });

  test('should navigate to clients page', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  });

  test('should navigate to contacts page', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
  });

  test('should navigate to vendors page', async ({ page }) => {
    await page.goto('/vendors');
    await expect(page.getByRole('heading', { name: 'Vendors' })).toBeVisible();
  });

  test('should navigate to applications page', async ({ page }) => {
    await page.goto('/applications');
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
  });

  test('should navigate to interviews page', async ({ page }) => {
    await page.goto('/interviews');
    await expect(page.getByRole('heading', { name: 'Interviews' })).toBeVisible();
  });

  test('should navigate to offers page', async ({ page }) => {
    await page.goto('/offers');
    await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible();
  });

  test('should redirect unknown routes to home', async ({ page }) => {
    await page.goto('/some-nonexistent-page');
    await expect(page).toHaveURL('/');
  });
});
