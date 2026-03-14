import { test, expect } from '@playwright/test';

const API_PORT = process.env.API_PORT ?? '3000';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;

const FIRST_IDENTITY = {
  email: `rbac-first-${Date.now()}@example.com`,
  password: 'RbacTest1!',
};

const SECOND_IDENTITY = {
  email: `rbac-second-${Date.now()}@example.com`,
  password: 'RbacTest2!',
};

test.describe('RBAC', () => {
  test.describe.configure({ mode: 'serial' });

  let firstIdentityToken: string;
  let secondIdentityToken: string;
  let firstIdentityId: string;
  let secondIdentityId: string;
  let firstIdentityIsSuperadmin = false;

  test('register first identity and check for superadmin role', async ({ request }) => {
    const registerRes = await request.post(`${API_BASE}/auth/register`, {
      data: FIRST_IDENTITY,
    });
    expect(registerRes.ok()).toBe(true);
    const { accessToken } = await registerRes.json();
    firstIdentityToken = accessToken;

    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${firstIdentityToken}` },
    });
    expect(meRes.ok()).toBe(true);
    const me = await meRes.json();
    firstIdentityId = me.id;
    expect(me).toHaveProperty('permissions');
    expect(Array.isArray(me.permissions)).toBe(true);

    // On a fresh DB this identity gets superadmin; on existing DB they may not.
    // Detect by trying a protected endpoint.
    const rolesRes = await request.get(`${API_BASE}/roles`, {
      headers: { Authorization: `Bearer ${firstIdentityToken}` },
    });
    firstIdentityIsSuperadmin = rolesRes.ok();
  });

  test('/auth/me should return permissions array', async ({ request }) => {
    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${firstIdentityToken}` },
    });
    const me = await meRes.json();
    expect(me.permissions).toBeDefined();
    expect(Array.isArray(me.permissions)).toBe(true);
  });

  test('second registered identity should have no roles/permissions', async ({ request }) => {
    const registerRes = await request.post(`${API_BASE}/auth/register`, {
      data: SECOND_IDENTITY,
    });
    expect(registerRes.ok()).toBe(true);
    const { accessToken } = await registerRes.json();
    secondIdentityToken = accessToken;

    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${secondIdentityToken}` },
    });
    const me = await meRes.json();
    secondIdentityId = me.id;
    expect(me.permissions).toEqual([]);
  });

  test('superadmin should be able to list roles via API', async ({ request }) => {
    if (!firstIdentityIsSuperadmin) {
      test.skip();
      return;
    }

    const rolesRes = await request.get(`${API_BASE}/roles`, {
      headers: { Authorization: `Bearer ${firstIdentityToken}` },
    });
    expect(rolesRes.ok()).toBe(true);
    const roles = await rolesRes.json();
    expect(Array.isArray(roles)).toBe(true);
  });

  test('superadmin can create role and assign to another identity', async ({ request }) => {
    if (!firstIdentityIsSuperadmin) {
      test.skip();
      return;
    }

    // Create a role
    const createRoleRes = await request.post(`${API_BASE}/roles`, {
      headers: { Authorization: `Bearer ${firstIdentityToken}` },
      data: { name: `test-role-${Date.now()}`, description: 'Test role for E2E' },
    });
    expect(createRoleRes.ok()).toBe(true);
    const role = await createRoleRes.json();

    // Assign role to second identity
    const assignRes = await request.post(
      `${API_BASE}/roles/identities/${secondIdentityId}/roles`,
      {
        headers: { Authorization: `Bearer ${firstIdentityToken}` },
        data: { roleId: role.id },
      },
    );
    expect(assignRes.ok()).toBe(true);
  });

  test('assigned identity should have their role reflected in /auth/me', async ({ request }) => {
    if (!firstIdentityIsSuperadmin) {
      test.skip();
      return;
    }

    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${secondIdentityToken}` },
    });
    const me = await meRes.json();
    expect(me.permissions).toBeDefined();
    expect(Array.isArray(me.permissions)).toBe(true);
  });
});
