import { test, expect } from './fixtures/auth';

test.describe('Reports', () => {
  test('page renders heading and KPI strip', async ({ authedPage }) => {
    await authedPage.goto('/reports');
    await expect(authedPage.getByRole('heading', { name: /Reports/i }).first()).toBeVisible();
    // KPI strip shows on-time rate / overdue.
    await expect(authedPage.getByText(/on-time/i).first()).toBeVisible();
    await expect(authedPage.getByText(/overdue/i).first()).toBeVisible();
  });

  test('report tabs switch the visible chart/table', async ({ authedPage }) => {
    await authedPage.goto('/reports');
    // Compliance is the default tab.
    const overdueTab = authedPage.getByRole('tab', { name: /overdue/i });
    await overdueTab.click();
    await expect(overdueTab).toHaveAttribute('aria-selected', 'true');

    const workloadTab = authedPage.getByRole('tab', { name: /workload/i });
    await workloadTab.click();
    await expect(workloadTab).toHaveAttribute('aria-selected', 'true');
  });

  test('search input is usable on the compliance tab', async ({ authedPage }) => {
    await authedPage.goto('/reports');
    const search = authedPage.getByPlaceholder(/search/i).first();
    await expect(search).toBeVisible();
    await search.fill('GST');
  });
});
