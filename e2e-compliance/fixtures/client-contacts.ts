import { apiClient } from '../helpers/api-client';
import { uniqueEmail } from '../helpers/unique-name';

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  email: string;
  phone: string | null;
  isPrimary: boolean;
}

export interface CreateClientContactOverrides {
  name?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export async function createClientContact(
  clientId: string,
  overrides: CreateClientContactOverrides = {},
): Promise<ClientContact> {
  return apiClient.post<ClientContact>('/client-contacts', {
    clientId,
    name: overrides.name ?? 'E2E Contact',
    email: overrides.email ?? uniqueEmail('contact'),
    phone: overrides.phone ?? '+919876543210',
    isPrimary: overrides.isPrimary ?? true,
  });
}
