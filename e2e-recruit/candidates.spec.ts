import { test, expect } from '@playwright/test';
import { setupAllMocks, MOCK_DATA } from './fixtures/setup';

test.describe('Candidates', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  // ---------------------------------------------------------------------------
  // List Page
  // ---------------------------------------------------------------------------

  test.describe('List page', () => {
    test('should display page heading and add button', async ({ page }) => {
      await page.goto('/candidates');
      await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Candidate' })).toBeVisible();
    });

    test('should display candidates in the data grid', async ({ page }) => {
      await page.goto('/candidates');
      // Default sort is createdAt desc, so the most recently created candidate appears first
      const lastCandidate = MOCK_DATA.candidates[MOCK_DATA.candidates.length - 1];
      await expect(page.locator('table').getByText(lastCandidate.fullName).first()).toBeVisible();
    });

    test('should show pagination info', async ({ page }) => {
      await page.goto('/candidates');
      await expect(page.getByText(/Showing .* to .* of .* results/)).toBeVisible();
    });

    test('should filter results by search query', async ({ page }) => {
      await page.goto('/candidates');
      const searchTarget = MOCK_DATA.candidates[0].firstName;
      await page.getByPlaceholder('Search candidates...').fill(searchTarget);
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(new RegExp(`search=${searchTarget}`));
    });

    test('should clear search with X button', async ({ page }) => {
      await page.goto('/candidates?search=James');
      await page.getByLabel('Clear search').click();
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/search=/);
    });

    test('should sort by column when header is clicked', async ({ page }) => {
      await page.goto('/candidates');
      await page.locator('th').getByText('Name').click();
      await expect(page).toHaveURL(/sort=fullName/);
      await expect(page).toHaveURL(/order=asc/);
    });

    test('should toggle sort direction on second click', async ({ page }) => {
      await page.goto('/candidates?sort=fullName&order=asc');
      await page.locator('th').getByText('Name').click();
      await expect(page).toHaveURL(/order=desc/);
    });

    test('should navigate to next page', async ({ page }) => {
      await page.goto('/candidates');
      await page.getByLabel('Next page').click();
      await expect(page).toHaveURL(/page=2/);
    });

    test('should navigate to last page', async ({ page }) => {
      await page.goto('/candidates');
      await page.getByLabel('Last page').click();
      await expect(page).toHaveURL(/page=2/);
    });

    test('should change page size', async ({ page }) => {
      await page.goto('/candidates');
      const pageSizeSelect = page.getByText('Rows per page').locator('..').locator('select');
      await pageSizeSelect.selectOption('10');
      await expect(page).toHaveURL(/limit=10/);
    });

    test('should toggle column visibility', async ({ page }) => {
      await page.goto('/candidates');
      await page.getByRole('button', { name: /Columns/ }).click();
      const emailCheckbox = page.locator('label').filter({ hasText: 'Email' }).locator('input');
      await emailCheckbox.uncheck();
      await page.locator('body').click({ position: { x: 0, y: 0 } });
      await expect(page.locator('th').filter({ hasText: 'Email' })).not.toBeVisible();
    });

    test('should show empty state when no results match search', async ({ page }) => {
      await page.goto('/candidates');
      await page.getByPlaceholder('Search candidates...').fill('zzzznonexistent');
      await page.waitForTimeout(500);
      await expect(page.getByText('No candidates yet')).toBeVisible();
    });

    test('should preserve table state in URL on page reload', async ({ page }) => {
      await page.goto('/candidates?page=2&sort=fullName&order=asc&search=James');
      await expect(page.getByPlaceholder('Search candidates...')).toHaveValue('James');
      await expect(page).toHaveURL(/page=2/);
      await expect(page).toHaveURL(/sort=fullName/);
      await expect(page).toHaveURL(/order=asc/);
      await expect(page).toHaveURL(/search=James/);
    });

    test('should navigate to candidate detail on name click', async ({ page }) => {
      await page.goto('/candidates');
      const lastCandidate = MOCK_DATA.candidates[MOCK_DATA.candidates.length - 1];
      await page.locator('table').getByText(lastCandidate.fullName).first().click();
      await expect(page).toHaveURL(new RegExp(`/candidates/${lastCandidate.id}`));
    });
  });

  // ---------------------------------------------------------------------------
  // Detail Page (CandidateProfilePage)
  // ---------------------------------------------------------------------------

  test.describe('Detail page', () => {
    test('should display candidate name and info', async ({ page }) => {
      const candidate = MOCK_DATA.candidates[0];
      await page.goto(`/candidates/${candidate.id}`);
      await expect(page.getByRole('heading', { name: candidate.fullName })).toBeVisible();
    });

    test('should display candidate email', async ({ page }) => {
      const candidate = MOCK_DATA.candidates[0];
      await page.goto(`/candidates/${candidate.id}`);
      await expect(page.getByText(candidate.email).first()).toBeVisible();
    });

    test('should show back link to candidates list', async ({ page }) => {
      const candidate = MOCK_DATA.candidates[0];
      await page.goto(`/candidates/${candidate.id}`);
      await expect(page.getByText('Candidates').first()).toBeVisible();
    });

    test('should display action buttons', async ({ page }) => {
      const candidate = MOCK_DATA.candidates[0];
      await page.goto(`/candidates/${candidate.id}`);
      // The "Apply to Job" button or similar action
      await expect(page.getByRole('button').first()).toBeVisible();
    });

    test('should navigate back to list on back link click', async ({ page }) => {
      const candidate = MOCK_DATA.candidates[0];
      await page.goto(`/candidates/${candidate.id}`);
      // Click the back link (the "Candidates" text link at the top)
      const backLink = page.locator('a, button').filter({ hasText: 'Candidates' }).first();
      await backLink.click();
      await expect(page).toHaveURL('/candidates');
    });
  });

  // ---------------------------------------------------------------------------
  // Quick Create (Modal)
  // ---------------------------------------------------------------------------

  test.describe('Quick create', () => {
    test('should open quick create modal when Add button is clicked', async ({ page }) => {
      await page.goto('/candidates');
      await page.getByRole('button', { name: 'Add Candidate' }).click();
      await expect(page.getByRole('heading', { name: 'Add Candidate' })).toBeVisible();
      await expect(page.getByText('Quick create')).toBeVisible();
    });

    test('should show quick create form fields', async ({ page }) => {
      await page.goto('/candidates');
      await page.getByRole('button', { name: 'Add Candidate' }).click();
      // Quick create fields: firstName, lastName, email, mobile, candidateStatus
      await expect(page.getByLabel('First Name')).toBeVisible();
      await expect(page.getByLabel('Last Name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
    });

    test('should close modal on cancel', async ({ page }) => {
      await page.goto('/candidates');
      await page.getByRole('button', { name: 'Add Candidate' }).click();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByText('Quick create')).not.toBeVisible();
    });

    test('should submit quick create form and navigate to detail', async ({ page }) => {
      await page.goto('/candidates');
      await page.getByRole('button', { name: 'Add Candidate' }).click();

      await page.getByLabel('First Name').fill('Test');
      await page.getByLabel('Last Name').fill('Candidate');
      await page.getByLabel('Email').fill('test@example.com');

      await page.getByRole('button', { name: 'Create Candidate' }).click();

      // Should navigate to the newly created candidate
      await expect(page).toHaveURL(/\/candidates\/new-entity-001/);
    });
  });
});
