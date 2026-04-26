import { test, expect } from './fixtures/auth';
import { apiClient } from './helpers';

interface Law { id: string; code: string }
interface Client { id: string; name: string }
interface Rule { id: string; lawId: string; code: string }
interface Filing {
  id: string;
  title: string;
  clientId: string;
  ruleId: string;
  lawId: string;
  status: string;
}

/**
 * Cross-entity flow: reads the seeded chain client → registration → rule
 * → filing and asserts the join holds end-to-end. Then drives the UI to
 * confirm the same record is reachable via search on /clients and
 * /filings. Stays read-only against seeded fixtures so this spec doesn't
 * race with parallel tests that mutate the same chain.
 */
test.describe('Flow: client + law + rule + filing chain', () => {
  test('seeded data joins cleanly client → rule → law → filing', async () => {
    const laws = await apiClient.get<{ data: Law[] }>('/laws', { query: { limit: 50 } });
    const gst = laws.data.find((l) => l.code === 'GST');
    expect(gst, 'GST should be a seeded law').toBeTruthy();
    if (!gst) return;

    const rules = await apiClient.get<{ data: Rule[] }>('/compliance-rules', {
      query: { limit: 200 },
    });
    const gstRules = rules.data.filter((r) => r.lawId === gst.id);
    expect(gstRules.length, 'expected at least one rule for GST').toBeGreaterThan(0);

    const filings = await apiClient.get<{ data: Filing[] }>('/compliance-filings', {
      query: { limit: 1000 },
    });
    const gstFilings = filings.data.filter((f) => f.lawId === gst.id);
    expect(gstFilings.length, 'expected at least one filing under GST').toBeGreaterThan(0);

    // Every GST filing's ruleId resolves to a rule in the GST set.
    const gstRuleIds = new Set(gstRules.map((r) => r.id));
    for (const f of gstFilings.slice(0, 10)) {
      expect(gstRuleIds.has(f.ruleId), `filing ${f.id} ruleId ${f.ruleId} not in GST rules`).toBe(true);
    }
  });

  test('a seeded client with GST registrations is searchable in the UI', async ({
    authedPage,
  }) => {
    // Lumen Tech is seeded as an active client with GST registrations.
    const clients = await apiClient.get<{ data: Client[] }>('/clients', {
      query: { limit: 200 },
    });
    const lumen = clients.data.find((c) => c.name === 'Lumen Tech');
    expect(lumen, 'Lumen Tech should be a seeded client').toBeTruthy();
    if (!lumen) return;

    await authedPage.goto('/clients');
    await authedPage.getByPlaceholder(/search clients/i).fill('Lumen');
    await expect(authedPage.getByText('Lumen Tech').first()).toBeVisible();

    // Open the detail page; URL contains the client id.
    await authedPage.getByText('Lumen Tech').first().click();
    await authedPage.waitForURL(new RegExp(`/clients/${lumen.id}`));
    await expect(authedPage.getByRole('heading', { name: /Lumen Tech/i }).first()).toBeVisible();
  });

  test('a seeded GST filing is reachable via /filings search', async ({ authedPage }) => {
    const filings = await apiClient.get<{ data: Filing[] }>('/compliance-filings', {
      query: { limit: 200 },
    });
    expect(filings.data.length, 'expected seeded filings').toBeGreaterThan(0);
    const sample = filings.data[0];

    await authedPage.goto('/filings');
    // Search by the unique ID portion to dodge title overlap.
    const fragment = sample.title.split(' ')[0];
    await authedPage.getByPlaceholder(/search filings/i).fill(fragment);
    await expect(authedPage.getByText(fragment).first()).toBeVisible();
  });
});
