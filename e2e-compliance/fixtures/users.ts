import { apiClient } from '../helpers/api-client';
import { uniqueEmail } from '../helpers/unique-name';

export interface CreateUserOverrides {
  email?: string;
  firstName?: string;
  lastName?: string;
  userType?: string;
  password?: string;
}

export interface CreatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Creates a user via the admin path. Pass `password` to set a credential
 * synchronously so the test can immediately log in as the new user
 * (covers the RBAC flow). Without `password`, the user is invited and
 * has no password set — caller must drive the invite-acceptance flow.
 */
export async function createUser(overrides: CreateUserOverrides = {}): Promise<CreatedUser> {
  const body: Record<string, unknown> = {
    email: overrides.email ?? uniqueEmail('user'),
    firstName: overrides.firstName ?? 'E2E',
    lastName: overrides.lastName ?? 'User',
    userType: overrides.userType ?? 'client',
  };
  if (overrides.password) {
    body.credentials = { password: overrides.password };
  }
  return apiClient.post<CreatedUser>('/users', body);
}
