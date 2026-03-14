import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@packages/database';
import { SettingsRegistryService } from '@packages/settings-nestjs';
import { z } from 'zod';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../test/factories/identityFactory';

describe('Settings API — integration', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;
  let registry: SettingsRegistryService;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    httpServer = testApp.httpServer;
    registry = testApp.module.get(SettingsRegistryService);

    // Register a test settings module for testing
    if (!registry.has('test-module')) {
      registry.register({
        module: 'test-module',
        label: 'Test Module',
        schema: z.object({
          timeout: z.number().min(1).max(600).default(30),
          enabled: z.boolean().default(true),
        }),
        metadata: {
          timeout: { label: 'Timeout', type: 'number', min: 1, max: 600 },
          enabled: { label: 'Enabled', type: 'boolean' },
        },
      });
    }
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  async function createSettingsAdmin() {
    const identity = await IdentityFactory.create(prisma);
    const roleName = `settings-admin-${identity.id.slice(0, 8)}`;
    const role = await prisma.role.create({
      data: { name: roleName, description: 'Settings admin' },
    });

    const readPerm = await prisma.permission.upsert({
      where: { resource_action: { resource: 'settings', action: 'read' } },
      create: { resource: 'settings', action: 'read' },
      update: {},
    });
    const managePerm = await prisma.permission.upsert({
      where: { resource_action: { resource: 'settings', action: 'manage' } },
      create: { resource: 'settings', action: 'manage' },
      update: {},
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: readPerm.id } },
      create: { roleId: role.id, permissionId: readPerm.id },
      update: {},
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: managePerm.id } },
      create: { roleId: role.id, permissionId: managePerm.id },
      update: {},
    });

    await prisma.identityRole.create({
      data: { identityId: identity.id, roleId: role.id },
    });

    return identity;
  }

  describe('GET /api/v1/settings', () => {
    it('should return all registered module settings', async () => {
      const admin = await createSettingsAdmin();

      const res = await request(httpServer)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const testModule = res.body.find((m: { module: string }) => m.module === 'test-module');
      expect(testModule).toBeDefined();
      expect(testModule.label).toBe('Test Module');
      expect(testModule.fields).toHaveLength(2);
    });
  });

  describe('GET /api/v1/settings/:module', () => {
    it('should return settings for a specific module', async () => {
      const admin = await createSettingsAdmin();

      const res = await request(httpServer)
        .get('/api/v1/settings/test-module')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(res.body.module).toBe('test-module');
      expect(res.body.fields).toHaveLength(2);

      const timeoutField = res.body.fields.find((f: { key: string }) => f.key === 'timeout');
      expect(timeoutField.value).toBe(30);
      expect(timeoutField.default).toBe(30);
      expect(timeoutField.isOverridden).toBe(false);
    });

    it('should return 404 for unknown module', async () => {
      const admin = await createSettingsAdmin();

      const res = await request(httpServer)
        .get('/api/v1/settings/nonexistent')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/settings/:module', () => {
    it('should update settings and return resolved values', async () => {
      const admin = await createSettingsAdmin();

      const res = await request(httpServer)
        .patch('/api/v1/settings/test-module')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ settings: [{ key: 'timeout', value: 120 }] });

      expect(res.status).toBe(200);

      const timeoutField = res.body.fields.find((f: { key: string }) => f.key === 'timeout');
      expect(timeoutField.value).toBe(120);
      expect(timeoutField.isOverridden).toBe(true);
    });

    it('should return 400 for invalid value', async () => {
      const admin = await createSettingsAdmin();

      const res = await request(httpServer)
        .patch('/api/v1/settings/test-module')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ settings: [{ key: 'timeout', value: -5 }] });

      expect(res.status).toBe(400);
    });

    it('should return 400 for unknown key', async () => {
      const admin = await createSettingsAdmin();

      const res = await request(httpServer)
        .patch('/api/v1/settings/test-module')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ settings: [{ key: 'nonexistent', value: 'foo' }] });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing settings array', async () => {
      const admin = await createSettingsAdmin();

      const res = await request(httpServer)
        .patch('/api/v1/settings/test-module')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/settings/:module/:key', () => {
    it('should reset setting to default', async () => {
      const admin = await createSettingsAdmin();

      // First set an override
      await request(httpServer)
        .patch('/api/v1/settings/test-module')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ settings: [{ key: 'timeout', value: 999 }] });

      // Reset it
      const res = await request(httpServer)
        .delete('/api/v1/settings/test-module/timeout')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);

      const timeoutField = res.body.fields.find((f: { key: string }) => f.key === 'timeout');
      expect(timeoutField.value).toBe(30);
      expect(timeoutField.isOverridden).toBe(false);
    });
  });
});
