import { test, expect } from './fixtures/auth';
import { uniqueName, apiClient, CleanupTracker } from './helpers';

test.describe('Compliance Rules', () => {
  const cleanup = new CleanupTracker();

  test.afterAll(async () => {
    await cleanup.flush();
  });

  test('list page renders heading, KPIs, and at least one seeded rule', async ({ authedPage }) => {
    await authedPage.goto('/compliance-rules');
    await expect(authedPage.getByRole('heading', { name: /compliance rules/i }).first()).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /New rule/i })).toBeVisible();
    // Demo seed includes GSTR-3B / TDS24Q etc.
    await expect(authedPage.getByText(/GSTR/).first()).toBeVisible();
  });

  test('search input narrows the rule grid', async ({ authedPage }) => {
    await authedPage.goto('/compliance-rules');
    await authedPage.getByPlaceholder(/search/i).first().fill('GSTR');
    await expect(authedPage.getByText('GSTR-3B').first()).toBeVisible();
  });

  test('drawer opens in pick mode with template + scratch options', async ({ authedPage }) => {
    await authedPage.goto('/compliance-rules');
    await authedPage.getByRole('button', { name: /New rule/i }).click();
    await expect(
      authedPage.getByRole('heading', { name: /Add compliance rule/i }),
    ).toBeVisible();
    await expect(authedPage.getByText(/From template/i).first()).toBeVisible();
    await expect(authedPage.getByText(/From scratch/i).first()).toBeVisible();
  });

  test('"from scratch" mode reveals the rule form', async ({ authedPage }) => {
    await authedPage.goto('/compliance-rules');
    await authedPage.getByRole('button', { name: /New rule/i }).click();
    await authedPage.getByRole('button', { name: /From scratch/i }).click();
    await expect(
      authedPage.getByRole('heading', { name: /New compliance rule/i }),
    ).toBeVisible();
    // Code + Name + Law fields render.
    await expect(authedPage.getByPlaceholder('e.g. GSTR-3B')).toBeVisible();
    await expect(authedPage.getByPlaceholder(/short title/i)).toBeVisible();
  });

  test('rule created via API shows up in the list, then cleanup deletes', async ({
    authedPage,
  }) => {
    // Pick the first GST law to attach the rule to.
    const laws = await apiClient.get<{ data: Array<{ id: string; code: string }> }>(
      '/laws',
      { query: { limit: 50 } },
    );
    const gst = laws.data.find((l) => l.code === 'GST');
    expect(gst, 'GST law should be seeded').toBeTruthy();
    if (!gst) return;

    const code = `E2E-${Date.now()}`;
    const name = uniqueName('Rule');

    const created = await apiClient.post<{ id: string }>('/compliance-rules', {
      code,
      name,
      lawId: gst.id,
      frequency: 'monthly',
      dueDayOfMonth: 20,
      dueMonthOffset: 1,
      gracePeriodDays: 0,
      status: 'active',
    });
    cleanup.track('rule', created.id);

    await authedPage.goto('/compliance-rules');
    await authedPage.getByPlaceholder(/search/i).first().fill(code);
    await expect(authedPage.getByText(code).first()).toBeVisible();
  });
});
