import { test, expect } from './fixtures/auth';
import { uniqueName, uniqueEmail, apiClient, CleanupTracker } from './helpers';

interface Client { id: string; status: string }

/**
 * Cross-entity flow: drive a client through its workflow states
 * (onboarding → active → dormant → active) via the transition endpoint
 * and verify the persisted status changes plus the workflow rejects
 * illegal moves. Filings transitions are covered separately by the
 * compliance-filings integration tests; this spec stays focused on
 * clients because their state graph is the richest of the compliance
 * entities.
 */
test.describe('Flow: client workflow transitions', () => {
  const cleanup = new CleanupTracker();

  test.afterAll(async () => {
    await cleanup.flush();
  });

  async function createOnboardingClient(): Promise<Client> {
    const name = uniqueName('WfClient');
    const client = await apiClient.post<Client>('/clients', {
      name,
      legalName: `${name} Pvt. Ltd.`,
      email: uniqueEmail('wf'),
      taxId: `27AAAAA${Date.now().toString().slice(-5)}1Z5`,
      status: 'onboarding',
    });
    cleanup.track('client', client.id);

    // Workflow guard requires a primary contact before onboarding → active.
    const contact = await apiClient.post<{ id: string }>('/client-contacts', {
      clientId: client.id,
      name: 'E2E Primary',
      email: uniqueEmail('contact'),
      phone: '+919876543210',
      isPrimary: true,
    });
    cleanup.track('client-contact', contact.id);

    return client;
  }

  test('onboarding → active transition flips status', async () => {
    const client = await createOnboardingClient();
    expect(client.status).toBe('onboarding');

    await apiClient.post(`/clients/${client.id}/transition`, {
      fieldKey: 'status',
      to: 'active',
    });

    const after = await apiClient.get<Client>(`/clients/${client.id}`);
    expect(after.status).toBe('active');
  });

  test('rejects an unknown target state', async () => {
    const client = await createOnboardingClient();

    let rejected = false;
    try {
      await apiClient.post(`/clients/${client.id}/transition`, {
        fieldKey: 'status',
        to: 'nonexistent-state',
      });
    } catch (err) {
      rejected = true;
      expect((err as Error).message).toMatch(/4\d\d|illegal|invalid|unknown|denied/i);
    }
    expect(rejected, 'unknown state should be rejected').toBe(true);
  });

  test('full path onboarding → active → dormant', async () => {
    const client = await createOnboardingClient();

    await apiClient.post(`/clients/${client.id}/transition`, {
      fieldKey: 'status',
      to: 'active',
    });
    await apiClient.post(`/clients/${client.id}/transition`, {
      fieldKey: 'status',
      to: 'dormant',
    });

    const final = await apiClient.get<Client>(`/clients/${client.id}`);
    expect(final.status).toBe('dormant');
  });

  test('dormant → active is allowed (reactivation)', async () => {
    const client = await createOnboardingClient();
    await apiClient.post(`/clients/${client.id}/transition`, {
      fieldKey: 'status',
      to: 'active',
    });
    await apiClient.post(`/clients/${client.id}/transition`, {
      fieldKey: 'status',
      to: 'dormant',
    });
    await apiClient.post(`/clients/${client.id}/transition`, {
      fieldKey: 'status',
      to: 'active',
    });

    const after = await apiClient.get<Client>(`/clients/${client.id}`);
    expect(after.status).toBe('active');
  });
});
