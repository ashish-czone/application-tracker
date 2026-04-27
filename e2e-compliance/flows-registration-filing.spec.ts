import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import { createComplianceChain, type ComplianceChain } from './fixtures/compliance-chain';

interface Law { id: string; code: string }
interface Rule { id: string; lawId: string; code: string }
interface Filing {
  id: string;
  title: string;
  clientId: string;
  ruleId: string;
  lawId: string;
  status: string;
}
interface Client { id: string; name: string }

/**
 * Cross-entity flow: builds a full compliance chain (team → law → client
 * → rule → registration → filing) and asserts the join holds end-to-end.
 * Then drives the UI to confirm the same record is reachable via search
 * on /clients and /filings.
 */
test.describe('Flow: client + law + rule + filing chain', () => {
  let chain: ComplianceChain;

  test.beforeAll(async () => {
    await resetState();
    chain = await createComplianceChain({ lawCode: 'GST' });
  });

  test('fixture data joins cleanly client → rule → law → filing', async () => {
    const laws = await apiClient.get<{ data: Law[] }>('/laws', { query: { limit: 50 } });
    const gst = laws.data.find((l) => l.code === 'GST');
    expect(gst, 'GST should be a system-seeded law').toBeTruthy();
    if (!gst) return;
    expect(gst.id).toBe(chain.law.id);

    const rules = await apiClient.get<{ data: Rule[] }>('/compliance-rules', {
      query: { limit: 200 },
    });
    const gstRules = rules.data.filter((r) => r.lawId === gst.id);
    expect(gstRules.find((r) => r.id === chain.rule.id), 'fixture rule under GST').toBeTruthy();

    const filings = await apiClient.get<{ data: Filing[] }>('/compliance-filings', {
      query: { limit: 1000 },
    });
    const fixtureFiling = filings.data.find((f) => f.id === chain.filing.id);
    expect(fixtureFiling, 'fixture filing exists in /compliance-filings').toBeTruthy();
    expect(fixtureFiling?.lawId).toBe(gst.id);
    expect(fixtureFiling?.clientId).toBe(chain.client.id);
    expect(fixtureFiling?.ruleId).toBe(chain.rule.id);
  });

  test('the fixture client is searchable in the UI', async ({ authedPage }) => {
    const clients = await apiClient.get<{ data: Client[] }>('/clients', {
      query: { limit: 200 },
    });
    const found = clients.data.find((c) => c.id === chain.client.id);
    expect(found, 'fixture client should be in /clients').toBeTruthy();
    if (!found) return;

    await authedPage.goto('/clients');
    await authedPage.getByPlaceholder(/search clients/i).fill(chain.client.name);
    await expect(authedPage.getByText(chain.client.name).first()).toBeVisible();

    // Open the detail page; URL contains the client id.
    await authedPage.getByText(chain.client.name).first().click();
    await authedPage.waitForURL(new RegExp(`/clients/${chain.client.id}`));
    await expect(
      authedPage.getByRole('heading', { name: new RegExp(chain.client.name, 'i') }).first(),
    ).toBeVisible();
  });

  test('the fixture filing is reachable via /filings search', async ({ authedPage }) => {
    await authedPage.goto('/filings');
    await authedPage.getByPlaceholder(/search filings/i).fill(chain.filing.title);
    await expect(authedPage.getByText(chain.filing.title).first()).toBeVisible();
  });
});
