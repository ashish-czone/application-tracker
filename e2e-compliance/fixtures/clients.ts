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
  return apiClient.post<CreatedClient>('/clients', {
    name,
    legalName,
    taxId: overrides.taxId ?? deterministicTaxId(),
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    status: overrides.status ?? 'active',
  });
}
