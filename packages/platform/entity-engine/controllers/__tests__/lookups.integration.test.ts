import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, type PackageTestApp } from '@packages/platform-testing';
import { EntityEngineModule } from '../../entity-engine.module';
import { EAV_PERMISSIONS } from '../../permissions';

const READ = [EAV_PERMISSIONS.READ];

describe('LookupsController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [EntityEngineModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  // ── List entities ──────────────────────────────────────────────────

  describe('GET /api/v1/lookups', () => {
    it('should return registered lookup entities', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/lookups')
        .set(withAuth(READ))
        .expect(200);

      // Returns array of registered lookup entity names
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Search ──────────────────────────────────────────────────

  describe('GET /api/v1/lookups/:entity', () => {
    it('should return 200 for a lookup search (even if entity not registered)', async () => {
      // LookupResolverService returns empty array for unregistered entities
      const res = await request(ctx.httpServer)
        .get('/api/v1/lookups/some-entity?search=test')
        .set(withAuth(READ))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/lookups')
        .expect(401);
    });
  });
});
