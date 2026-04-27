import { test, expect } from './fixtures/auth';
import { resetState, uniqueEmail, apiClient } from './helpers';
import { createClient } from './fixtures/clients';
import { createUser } from './fixtures/users';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3012';

interface User {
  id: string;
  email: string;
}

/**
 * RBAC flow: verify the API auth/permission boundary.
 *
 * - Unauthenticated request → 401.
 * - Invalid-token request → 401.
 * - Newly invited user (default 'Client' role with no granted permissions)
 *   gets 403 on `/clients` while the seeded e2e-admin can list freely.
 */
test.describe('Flow: RBAC permission enforcement', () => {
  test.beforeAll(async () => {
    await resetState();
    // The "admin can list clients" test asserts length > 0 — seed at least
    // one row so the assertion is meaningful regardless of filing/registration
    // setup elsewhere.
    await createClient();
  });

  test('unauthenticated request returns 401', async () => {
    const res = await fetch(`${API_URL}/api/v1/clients`);
    expect(res.status).toBe(401);
  });

  test('invalid token returns 401', async () => {
    const res = await fetch(`${API_URL}/api/v1/clients`, {
      headers: { authorization: 'Bearer not-a-real-jwt' },
    });
    expect(res.status).toBe(401);
  });

  test('e2e-admin can list clients', async () => {
    const list = await apiClient.get<{ data: User[] }>('/clients', { query: { limit: 1 } });
    expect(list.data.length).toBeGreaterThan(0);
  });

  test('a default-role user cannot list clients (403)', async () => {
    // 65s allowance for the auth-throttle retry.
    test.setTimeout(120_000);

    const email = uniqueEmail('rbac');
    const password = 'RbacTest1234';

    await createUser({ firstName: 'RBAC', lastName: 'Tester', email, password });

    // Log in as the new user (retry once on 429 — auth has 5/min throttle).
    async function login(): Promise<Response> {
      return fetch(`${API_URL}/api/v1/auth/client/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: email, password }),
      });
    }
    let loginRes = await login();
    if (loginRes.status === 429) {
      await new Promise((r) => setTimeout(r, 65_000));
      loginRes = await login();
    }
    expect(loginRes.ok, `default user login should succeed (got ${loginRes.status})`).toBe(true);
    const tokens = (await loginRes.json()) as { accessToken: string };

    // Their default-role token should not be allowed to read clients.
    const denied = await fetch(`${API_URL}/api/v1/clients`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(denied.status, 'default-role user should hit 403 on clients').toBe(403);
  });
});
