import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import {
  createClient,
  transitionClient,
  updateClient,
} from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule } from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { runGenerator } from './fixtures/cron';

interface FilingRow {
  id: string;
  clientId: string;
}

/**
 * §1 client management — named coverage for stories that don't already
 * have a dedicated test:
 *
 *   US-1.2 Edit client details (PATCH persists, dotted fields round-trip)
 *   US-1.3 Mark a client dormant — generator excludes dormant clients
 *
 * US-1.1 (add), US-1.4 (restore), US-1.5 (search/filter) are covered by
 * `clients.spec.ts` (UI) and `flows-workflow.spec.ts` (transitions).
 */
test.describe('Flow: client lifecycle (US-1.x)', () => {
  let team: OrgUnit;
  let law: Law;

  test.beforeAll(async () => {
    await resetState();
    team = await createOrgUnit({ level: 'Team' });
    law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
  });

  test('US-1.2 PATCH /clients/:id persists field changes', async () => {
    const created = await createClient({ name: 'Original Co', email: 'old@e2e.local' });
    const updated = await updateClient(created.id, {
      name: 'Renamed Co',
      email: 'new@e2e.local',
    });

    expect(updated.name).toBe('Renamed Co');
    expect(updated.email).toBe('new@e2e.local');

    // Re-fetch to confirm persistence (not just an in-memory echo).
    const refetched = await apiClient.get<{ name: string; email: string | null }>(`/clients/${created.id}`);
    expect(refetched.name).toBe('Renamed Co');
    expect(refetched.email).toBe('new@e2e.local');
  });

  test('US-1.3 dormant client is excluded from generator output', async () => {
    // Build a complete chain (rule + registration) for a client we'll mark
    // dormant, plus a control chain whose client stays active.
    const rule = await createComplianceRule({ lawId: law.id });

    const dormantClient = await createClient({ status: 'active' });
    await createClientRegistration(dormantClient.id, law.id);

    const activeClient = await createClient({ status: 'active' });
    await createClientRegistration(activeClient.id, law.id);

    // Active → dormant. The transition is reasonRequired + commentRequired
    // (clients.config.ts) — dormancy cascades cancellation across non-terminal
    // filings, so the workflow forces an explanation that propagates into
    // each affected filing's history.
    await transitionClient(dormantClient.id, 'dormant', {
      reason: 'no longer engaged',
      comment: 'E2E US-1.3: client moved to dormant for generator exclusion check',
    });

    // Run the generator. Active client should get filings, dormant should not.
    await runGenerator('2026-06-15T02:00:00Z');

    const all = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const dormantFilings = all.data.filter((f) => f.clientId === dormantClient.id);
    const activeFilings = all.data.filter((f) => f.clientId === activeClient.id);

    expect(activeFilings.length).toBeGreaterThan(0);
    expect(dormantFilings, 'dormant client should produce no filings').toHaveLength(0);
  });
});
