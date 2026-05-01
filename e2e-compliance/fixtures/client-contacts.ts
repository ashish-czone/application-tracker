import { apiClient } from '../helpers/api-client';
import { uniqueEmail } from '../helpers/unique-name';

/**
 * Mirrors the directory `client_contacts` row shape after the C-2
 * shared-identity fold (#1186). Base columns (`fullName`, `primaryEmail`,
 * `primaryPhone`) come from `baseClientContactColumns` in @packages/directory;
 * the `compliance_*` prefixed columns are owned by the compliance domain.
 */
export interface ClientContact {
  id: string;
  fullName: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  complianceClientId: string | null;
  complianceDesignation: string | null;
  complianceIsPrimary: boolean;
  complianceNotes: string | null;
}

export interface CreateClientContactOverrides {
  fullName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  complianceDesignation?: string;
  complianceIsPrimary?: boolean;
  complianceNotes?: string;
}

export async function createClientContact(
  clientId: string,
  overrides: CreateClientContactOverrides = {},
): Promise<ClientContact> {
  return apiClient.post<ClientContact>('/client-contacts', {
    complianceClientId: clientId,
    fullName: overrides.fullName ?? 'E2E Contact',
    primaryEmail: overrides.primaryEmail ?? uniqueEmail('contact'),
    primaryPhone: overrides.primaryPhone ?? '+919876543210',
    complianceIsPrimary: overrides.complianceIsPrimary ?? true,
    ...(overrides.complianceDesignation !== undefined && {
      complianceDesignation: overrides.complianceDesignation,
    }),
    ...(overrides.complianceNotes !== undefined && {
      complianceNotes: overrides.complianceNotes,
    }),
  });
}
