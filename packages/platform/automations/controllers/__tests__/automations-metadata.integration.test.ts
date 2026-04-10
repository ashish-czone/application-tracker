import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, type PackageTestApp } from '@packages/platform-testing';
import { AutomationsModule } from '../../automations.module';
import { AUTOMATION_PERMISSIONS } from '../../permissions';

const READ = [AUTOMATION_PERMISSIONS.RULES_READ];

describe('AutomationsMetadataController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [AutomationsModule],
      mocks: { automations: false },
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  // ── Events ──────────────────────────────────────────────────

  describe('GET /api/v1/automations/events', () => {
    it('should return registered events', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/automations/events')
        .set(withAuth(READ))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Entities ──────────────────────────────────────────────────

  describe('GET /api/v1/automations/entities', () => {
    it('should return registered entity types', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/automations/entities')
        .set(withAuth(READ))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Action types ──────────────────────────────────────────────────

  describe('GET /api/v1/automations/action-types', () => {
    it('should return registered action types', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/automations/action-types')
        .set(withAuth(READ))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // WebhookAction is always registered by AutomationsModule
      const types = res.body.map((a: any) => a.type);
      expect(types).toContain('webhook');
    });
  });

  // ── User strategies ──────────────────────────────────────────────────

  describe('GET /api/v1/automations/user-strategies', () => {
    it('should return registered user resolution strategies', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/automations/user-strategies')
        .set(withAuth(READ))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Built-in strategies registered by AutomationsModule
      const types = res.body.map((s: any) => s.type);
      expect(types).toContain('actor');
      expect(types).toContain('entity_field');
      expect(types).toContain('role');
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/automations/events')
        .expect(401);
    });
  });
});
