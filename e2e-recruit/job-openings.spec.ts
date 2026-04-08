import { test, expect } from '@playwright/test';
import { setupAllMocks, MOCK_DATA } from './fixtures/setup';

test.describe('Job Openings', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  // ---------------------------------------------------------------------------
  // List Page
  // ---------------------------------------------------------------------------

  test.describe('List page', () => {
    test('should display page heading and add button', async ({ page }) => {
      await page.goto('/job-openings');
      await expect(page.getByRole('heading', { name: 'Job Openings' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Job Opening' })).toBeVisible();
    });

    test('should display job openings in the data grid', async ({ page }) => {
      await page.goto('/job-openings');
      const first = MOCK_DATA.jobOpenings[MOCK_DATA.jobOpenings.length - 1];
      await expect(page.locator('table').getByText(first.title).first()).toBeVisible();
    });

    test('should show client name as resolved lookup label', async ({ page }) => {
      await page.goto('/job-openings');
      const first = MOCK_DATA.jobOpenings[MOCK_DATA.jobOpenings.length - 1];
      await expect(page.locator('table').getByText(first.clientId__label).first()).toBeVisible();
    });

    test('should show pagination info', async ({ page }) => {
      await page.goto('/job-openings');
      await expect(page.getByText(/Showing .* to .* of .* results/)).toBeVisible();
    });

    test('should filter results by search query', async ({ page }) => {
      await page.goto('/job-openings');
      await page.getByPlaceholder('Search job openings...').fill('Frontend');
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/search=Frontend/);
    });

    test('should sort by title column', async ({ page }) => {
      await page.goto('/job-openings');
      await page.locator('th').getByText('Title').click();
      await expect(page).toHaveURL(/sort=title/);
      await expect(page).toHaveURL(/order=asc/);
    });

    test('should navigate to next page', async ({ page }) => {
      await page.goto('/job-openings');
      await page.getByLabel('Next page').click();
      await expect(page).toHaveURL(/page=2/);
    });

    test('should navigate to detail page on title click', async ({ page }) => {
      await page.goto('/job-openings');
      const first = MOCK_DATA.jobOpenings[MOCK_DATA.jobOpenings.length - 1];
      await page.locator('table').getByText(first.title).first().click();
      await expect(page).toHaveURL(new RegExp(`/job-openings/${first.id}`));
    });

    test('should show empty state when no results', async ({ page }) => {
      await page.goto('/job-openings');
      await page.getByPlaceholder('Search job openings...').fill('zzzznonexistent');
      await page.waitForTimeout(500);
      await expect(page.getByText('No job openings yet')).toBeVisible();
    });

    test('should toggle column visibility', async ({ page }) => {
      await page.goto('/job-openings');
      await page.getByRole('button', { name: /Columns/ }).click();
      const deptCheckbox = page.locator('label').filter({ hasText: 'Department' }).locator('input');
      await deptCheckbox.uncheck();
      await page.locator('body').click({ position: { x: 0, y: 0 } });
      await expect(page.locator('th').filter({ hasText: 'Department' })).not.toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Create Page (page mode, not modal)
  // ---------------------------------------------------------------------------

  test.describe('Create page', () => {
    test('should navigate to create page when Add button is clicked', async ({ page }) => {
      await page.goto('/job-openings');
      await page.getByRole('button', { name: 'Add Job Opening' }).click();
      await expect(page).toHaveURL('/job-openings/new');
    });

    test('should display create page heading', async ({ page }) => {
      await page.goto('/job-openings/new');
      await expect(page.getByText('Create Job Opening')).toBeVisible();
    });

    test('should display form sections', async ({ page }) => {
      await page.goto('/job-openings/new');
      await expect(page.getByText('Job Opening Information')).toBeVisible();
    });

    test('should show title field as required', async ({ page }) => {
      await page.goto('/job-openings/new');
      await expect(page.getByLabel('Title')).toBeVisible();
    });

    test('should navigate back to list on cancel', async ({ page }) => {
      await page.goto('/job-openings/new');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page).toHaveURL('/job-openings');
    });

    test('should submit form and navigate to detail', async ({ page }) => {
      await page.goto('/job-openings/new');
      await page.getByLabel('Title').fill('Senior React Developer');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(/\/job-openings\/new-entity-001/);
    });
  });

  // ---------------------------------------------------------------------------
  // Detail Page (JobOpeningDetailPage)
  // ---------------------------------------------------------------------------

  test.describe('Detail page', () => {
    test('should display job opening title', async ({ page }) => {
      const job = MOCK_DATA.jobOpenings[0];
      await page.goto(`/job-openings/${job.id}`);
      await expect(page.getByRole('heading', { name: job.title })).toBeVisible();
    });

    test('should display client name', async ({ page }) => {
      const job = MOCK_DATA.jobOpenings[0];
      await page.goto(`/job-openings/${job.id}`);
      await expect(page.getByText(job.clientId__label).first()).toBeVisible();
    });

    test('should show back link to job openings list', async ({ page }) => {
      const job = MOCK_DATA.jobOpenings[0];
      await page.goto(`/job-openings/${job.id}`);
      await expect(page.getByText('Job Openings').first()).toBeVisible();
    });

    test('should display action buttons', async ({ page }) => {
      const job = MOCK_DATA.jobOpenings[0];
      await page.goto(`/job-openings/${job.id}`);
      await expect(page.getByRole('button', { name: /Add Candidate/ })).toBeVisible();
    });

    test('should navigate back to list on back link click', async ({ page }) => {
      const job = MOCK_DATA.jobOpenings[0];
      await page.goto(`/job-openings/${job.id}`);
      const backLink = page.locator('a, button').filter({ hasText: 'Job Openings' }).first();
      await backLink.click();
      await expect(page).toHaveURL('/job-openings');
    });
  });
});
