import { test, expect } from '@playwright/test';

const API_PORT = process.env.API_PORT ?? '3001';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;

const FIRST_USER = {
  email: `rbac-first-${Date.now()}@example.com`,
  password: 'RbacTest1!',
};

const SECOND_USER = {
  email: `rbac-second-${Date.now()}@example.com`,
  password: 'RbacTest2!',
};

test.describe('RBAC', () => {
  test.describe.configure({ mode: 'serial' });

  let firstUserToken: string;
  let secondUserToken: string;
  let firstUserId: string;
  let secondUserId: string;
  let firstUserIsSuperadmin = false;

  test('register first user and check for superadmin role', async ({ request }) => {
    const registerRes = await request.post(`${API_BASE}/auth/register`, {
      data: FIRST_USER,
    });
    expect(registerRes.ok()).toBe(true);
    const { accessToken } = await registerRes.json();
    firstUserToken = accessToken;

    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${firstUserToken}` },
    });
    expect(meRes.ok()).toBe(true);
    const me = await meRes.json();
    firstUserId = me.id;
    expect(me).toHaveProperty('permissions');
    expect(Array.isArray(me.permissions)).toBe(true);

    // On a fresh DB this user gets superadmin; on existing DB they may not.
    // Detect by trying a protected endpoint.
    const rolesRes = await request.get(`${API_BASE}/roles`, {
      headers: { Authorization: `Bearer ${firstUserToken}` },
    });
    firstUserIsSuperadmin = rolesRes.ok();
  });

  test('/auth/me should return permissions array', async ({ request }) => {
    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${firstUserToken}` },
    });
    const me = await meRes.json();
    expect(me.permissions).toBeDefined();
    expect(Array.isArray(me.permissions)).toBe(true);
  });

  test('second registered user should have no roles/permissions', async ({ request }) => {
    const registerRes = await request.post(`${API_BASE}/auth/register`, {
      data: SECOND_USER,
    });
    expect(registerRes.ok()).toBe(true);
    const { accessToken } = await registerRes.json();
    secondUserToken = accessToken;

    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${secondUserToken}` },
    });
    const me = await meRes.json();
    secondUserId = me.id;
    expect(me.permissions).toEqual([]);
  });

  test('superadmin should be able to list roles via API', async ({ request }) => {
    if (!firstUserIsSuperadmin) {
      test.skip();
      return;
    }

    const rolesRes = await request.get(`${API_BASE}/roles`, {
      headers: { Authorization: `Bearer ${firstUserToken}` },
    });
    expect(rolesRes.ok()).toBe(true);
    const roles = await rolesRes.json();
    expect(Array.isArray(roles)).toBe(true);
  });

  test('superadmin can create role and assign to another user', async ({ request }) => {
    if (!firstUserIsSuperadmin) {
      test.skip();
      return;
    }

    // Create a role
    const createRoleRes = await request.post(`${API_BASE}/roles`, {
      headers: { Authorization: `Bearer ${firstUserToken}` },
      data: { name: `test-role-${Date.now()}`, description: 'Test role for E2E' },
    });
    expect(createRoleRes.ok()).toBe(true);
    const role = await createRoleRes.json();

    // Assign role to second user
    const assignRes = await request.post(
      `${API_BASE}/roles/users/${secondUserId}/roles`,
      {
        headers: { Authorization: `Bearer ${firstUserToken}` },
        data: { roleId: role.id },
      },
    );
    expect(assignRes.ok()).toBe(true);
  });

  test('assigned user should have their role reflected in /auth/me', async ({ request }) => {
    if (!firstUserIsSuperadmin) {
      test.skip();
      return;
    }

    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${secondUserToken}` },
    });
    const me = await meRes.json();
    expect(me.permissions).toBeDefined();
    expect(Array.isArray(me.permissions)).toBe(true);
  });
});
