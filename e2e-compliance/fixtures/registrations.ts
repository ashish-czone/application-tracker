import { apiClient } from '../helpers/api-client';

export interface ClientRegistration {
  id: string;
  clientId: string;
  lawId: string;
  registrationNumber: string | null;
  effectiveFrom: string | null;
  registeredAt: string;
  deactivatedAt: string | null;
}

export interface CreateClientRegistrationOptions {
  registrationNumber?: string;
  effectiveFrom?: string;
}

/**
 * Creates a client-registration. Requires a configured law-handler for
 * the law (see `createLawHandler` in fixtures/law-handlers.ts), otherwise
 * the I20 guard rejects the request.
 */
export async function createClientRegistration(
  clientId: string,
  lawId: string,
  options: CreateClientRegistrationOptions = {},
): Promise<ClientRegistration> {
  return apiClient.post<ClientRegistration>('/client-registrations', {
    clientId,
    lawId,
    ...options,
  });
}

export async function getClientRegistration(id: string): Promise<ClientRegistration> {
  return apiClient.get<ClientRegistration>(`/client-registrations/${id}`);
}
