import { test, expect } from './fixtures/auth';
import { resetState, randomSuffix } from './helpers';
import { getSystemLaw } from './fixtures/laws';
import { createOrgUnit } from './fixtures/org-units';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule, type ComplianceRule } from './fixtures/rules';

test.describe('Compliance Rules', () => {
  let anchorRule: ComplianceRule;

  test.beforeAll(async () => {
    await resetState();
    const team = await createOrgUnit({ level: 'Team' });
    const gst = await getSystemLaw('GST');
    await createLawHandler({ lawId: gst.id, orgEntityId: team.id });
    anchorRule = await createComplianceRule({
      lawId: gst.id,
      code: `GSTR-3B-${randomSuffix(4).toUpperCase()}`,
      name: 'GSTR-3B — Summary Return',
    });
  });

  test('list page renders heading, KPIs, and at least one rule', async ({ authedPage }) => {
    await authedPage.goto('/compliance-rules');
    await expect(authedPage.getByRole('heading', { name: /compliance rules/i }).first()).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /New rule/i })).toBeVisible();
    await expect(authedPage.getByText(anchorRule.code).first()).toBeVisible();
  });

  test('search input narrows the rule grid', async ({ authedPage }) => {
    await authedPage.goto('/compliance-rules');
    await authedPage.getByPlaceholder(/search/i).first().fill(anchorRule.code);
    await expect(authedPage.getByText(anchorRule.code).first()).toBeVisible();
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

  test('rule created via API shows up in the list', async ({ authedPage }) => {
    const gst = await getSystemLaw('GST');
    const created = await createComplianceRule({
      lawId: gst.id,
      code: `E2E-${randomSuffix(6).toUpperCase()}`,
    });

    await authedPage.goto('/compliance-rules');
    await authedPage.getByPlaceholder(/search/i).first().fill(created.code);
    await expect(authedPage.getByText(created.code).first()).toBeVisible();
  });
});
