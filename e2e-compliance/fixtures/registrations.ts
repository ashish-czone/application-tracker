import { apiClient } from '../helpers/api-client';

export interface ClientRegistration {
  id: string;
  clientId: string;
  lawId: string;
  registeredAt: string;
}

/**
 * Creates a client-registration. Requires a configured law-handler for
 * the law (see `createLawHandler` in fixtures/law-handlers.ts), otherwise
 * the I20 guard rejects the request.
 */
export async function createClientRegistration(
  clientId: string,
  lawId: string,
): Promise<ClientRegistration> {
  return apiClient.post<ClientRegistration>('/client-registrations', { clientId, lawId });
}
