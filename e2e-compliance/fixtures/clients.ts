import { apiClient } from '../helpers/api-client';
import { uniqueName } from '../helpers/unique-name';

/**
 * Test fixture helpers for the `clients` entity.
 *
 * Specs use these in `beforeAll` after `resetState()` to create the data
 * they assert against. The pattern is: each test owns the entities it
 * references — no spec asserts against demo-seed data, because the
 * reset endpoint strips it.
 *
 * Helpers default to deterministic-shape, uniquely-named rows so that
 * parallel suite runs (or back-to-back local runs against a shared DB)
 * never collide on names. Pass `overrides` for any field a specific
 * test cares about (e.g. status, dormant).
 */

export type ClientStatus = 'onboarding' | 'active' | 'dormant';

export interface CreateClientOverrides {
  name?: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  status?: ClientStatus;
}

export interface CreatedClient {
  id: string;
  name: string;
  legalName: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
}

const TAX_ID_PREFIX = '27ABCDE';

function deterministicTaxId(): string {
  // GSTIN-shape (15 chars): 2-digit state + 10-char PAN-ish + 1 entity + 1 default + 1 checksum.
  // Synthesised here rather than using libphonenumber/PAN libs — the API does
  // not validate format in V1; this is just a unique-enough placeholder.
  const suffix = String(Date.now()).slice(-5) + Math.floor(Math.random() * 90 + 10);
  return `${TAX_ID_PREFIX}${suffix}1Z5`;
}

export async function createClient(overrides: CreateClientOverrides = {}): Promise<CreatedClient> {
  const name = overrides.name ?? uniqueName('Client');
  const legalName = overrides.legalName ?? `${name} Pvt. Ltd.`;
  // Workflow state is system-managed: every client starts at
  // CLIENTS_WORKFLOW initialState ('onboarding'). Fixtures that need a
  // non-initial state walk the workflow via /transition; the
  // `onboarding → active` move requires a primary contact (guard), so
  // when a non-onboarding state is requested we add one before
  // transitioning. See `.claude/rules/workflow-entity-creates.md`.
  const created = await apiClient.post<CreatedClient>('/clients', {
    name,
    legalName,
    taxId: overrides.taxId ?? deterministicTaxId(),
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
  });

  const targetStatus = overrides.status ?? 'active';
  if (targetStatus === 'onboarding') return created;

  // Add a primary contact for the require-primary-contact guard.
  await apiClient.post('/client-contacts', {
    complianceClientId: created.id,
    fullName: `${name} Primary`,
    primaryEmail: overrides.email ?? `primary+${created.id.slice(0, 8)}@e2e.local`,
    complianceIsPrimary: true,
  });
  await transitionClient(created.id, 'active');

  if (targetStatus === 'dormant') {
    await transitionClient(created.id, 'dormant', {
      reason: 'fixture',
      comment: 'E2E fixture: requested dormant initial state',
    });
  }

  return apiClient.get<CreatedClient>(`/clients/${created.id}`);
}

/** Workflow transition on a client. The platform's transition endpoint
 *  validates the move against the client status workflow (onboarding →
 *  active → dormant → active) and rejects illegal targets. */
export async function transitionClient(
  clientId: string,
  to: ClientStatus,
  options: { reason?: string; comment?: string } = {},
): Promise<CreatedClient> {
  return apiClient.post<CreatedClient>(`/clients/${clientId}/transition`, {
    fieldKey: 'status',
    to,
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.comment ? { comment: options.comment } : {}),
  });
}

/** Patch arbitrary client fields. The service strips `status` defensively;
 *  use `transitionClient` for workflow moves. */
export async function updateClient(
  clientId: string,
  patch: Partial<{ name: string; legalName: string; taxId: string; email: string | null; phone: string | null }>,
): Promise<CreatedClient> {
  return apiClient.patch<CreatedClient>(`/clients/${clientId}`, patch);
}

/** Deactivate a (client, law) registration with a forward-only effective
 *  date. Past filings are preserved by default; pass `alsoCancelEarlier`
 *  to additionally cancel non-terminal filings whose periodEnd is before
 *  the deactivation date. */
export async function deactivateRegistration(
  clientId: string,
  lawId: string,
  options: { deactivatedAt: string; alsoCancelEarlier?: boolean; comment?: string },
): Promise<unknown> {
  return apiClient.post(`/clients/${clientId}/registrations/${lawId}/deactivate`, options);
}
