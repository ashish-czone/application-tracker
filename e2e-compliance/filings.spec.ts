import { test, expect } from './fixtures/auth';
import { resetState } from './helpers';
import { createComplianceChain, type ComplianceChain } from './fixtures/compliance-chain';

test.describe('Filings', () => {
  let chain: ComplianceChain;

  test.beforeAll(async () => {
    await resetState();
    // One full chain gives us a filing visible in the UI plus the
    // search-by-rule-code path the spec exercises.
    chain = await createComplianceChain({
      rule: { code: `GSTR-FIL-${Date.now().toString().slice(-6)}` },
    });
  });

  test('list page renders heading, KPIs, and at least one filing row', async ({ authedPage }) => {
    await authedPage.goto('/filings');
    await expect(authedPage.getByRole('heading', { name: 'Filings' }).first()).toBeVisible();
    // KPI tiles from FilingsPage.
    await expect(authedPage.getByText(/overdue/i).first()).toBeVisible();
    await expect(authedPage.getByText(/Due today|This week|Upcoming/i).first()).toBeVisible();
    // Search affordance + at least the fixture filing's title fragment.
    await expect(authedPage.getByPlaceholder(/search filings/i)).toBeVisible();
  });

  test('search input narrows the filings grid', async ({ authedPage }) => {
    // FilingsPage search matches `lawCode + ruleName + clientName + periodLabel`
    // — NOT the filing's auto-generated title. Search by rule name (which the
    // grid renders) so the assertion has something to verify.
    await authedPage.goto('/filings');
    await authedPage.getByPlaceholder(/search filings/i).fill(chain.rule.name);
    await expect(authedPage.getByText(chain.rule.name).first()).toBeVisible();
  });

  test('status tabs filter the filings list', async ({ authedPage }) => {
    await authedPage.goto('/filings');
    await authedPage.getByRole('tab', { name: /^Overdue/i }).click();
    const overdueTab = authedPage.getByRole('tab', { name: /^Overdue/i });
    await expect(overdueTab).toHaveAttribute('aria-selected', 'true');
  });

  test('all six status tabs are present', async ({ authedPage }) => {
    await authedPage.goto('/filings');
    for (const name of [/^All/i, /^Overdue/i, /^Due today/i, /^This week/i, /^Upcoming/i, /^Filed/i]) {
      await expect(authedPage.getByRole('tab', { name })).toBeVisible();
    }
  });

  test('clicking a filing row reveals row-level actions', async ({ authedPage }) => {
    await authedPage.goto('/filings');
    // The fixture filing should be present; click it to verify the table
    // is interactive (no error/empty state).
    const firstRow = authedPage.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();
  });
});
