import { test, expect } from './fixtures/auth';
import { resetState, uniqueName, uniqueEmail, apiClient } from './helpers';
import { createClientContact } from './fixtures/client-contacts';

interface Client {
  id: string;
  status: string;
}

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
  test.beforeAll(async () => {
    await resetState();
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

    // Workflow guard requires a primary contact before onboarding → active.
    await createClientContact(client.id, { isPrimary: true });

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
