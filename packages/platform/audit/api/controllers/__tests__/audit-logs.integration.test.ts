import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { AuditModule } from '../../audit.module';
import { AuditRegistryService } from '../../services/audit-registry.service';
import { AUDIT_PERMISSIONS } from '../../permissions';

const READ_ALL = [AUDIT_PERMISSIONS.READ_ALL];

describe('AuditLogsController (integration)', () => {
  let ctx: PackageTestApp;
  let registry: AuditRegistryService;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [AuditModule],
    });
    registry = ctx.module.get(AuditRegistryService);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    // Reset any per-test registrations
    for (const [name] of registry.getAll()) registry.register(name, { events: [] });
  });

  async function seedAuditLog(overrides: Record<string, unknown> = {}) {
    const id = randomUUID();
    const defaults = {
      id,
      entityType: 'candidates',
      entityId: randomUUID(),
      action: 'created',
      eventName: 'candidates.CandidateCreated',
      occurredAt: new Date().toISOString(),
    };
    const data = { ...defaults, ...overrides };

    await ctx.db.execute(
      sql`INSERT INTO audit_logs (id, entity_type, entity_id, action, event_name, occurred_at)
          VALUES (${data.id as string}, ${data.entityType as string}, ${data.entityId as string}, ${data.action as string}, ${data.eventName as string}, ${data.occurredAt as string}::timestamptz)`,
    );
    return data;
  }

  describe('Firm-wide queries (no entity filter)', () => {
    it('requires audit.read_all', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/audit-logs')
        .set(withAuth([]))
        .expect(403);
    });

    it('returns all logs when caller has audit.read_all', async () => {
      await seedAuditLog();
      await seedAuditLog({ entityType: 'orders' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs')
        .set(withAuth(READ_ALL))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('filter by entityType alone without entityId still requires audit.read_all', async () => {
      await seedAuditLog({ entityType: 'candidates' });

      await request(ctx.httpServer)
        .get('/api/v1/audit-logs?entityType=candidates')
        .set(withAuth([]))
        .expect(403);

      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs?entityType=candidates')
        .set(withAuth(READ_ALL))
        .expect(200);
      expect(res.body.data.length).toBe(1);
    });

    it('supports paging + filtering once authorised', async () => {
      for (let i = 0; i < 5; i++) await seedAuditLog();

      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs?page=2&limit=2')
        .set(withAuth(READ_ALL))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.page).toBe(2);
    });
  });

  describe('Per-entity queries (entityType + entityId)', () => {
    it('delegates to the module registration authoriseRead', async () => {
      const entityId = randomUUID();
      await seedAuditLog({ entityType: 'widgets', entityId });

      const allowedUser = randomUUID();
      const deniedUser = randomUUID();
      registry.register('widgets', {
        events: '*',
        authoriseRead: ({ user }) => user.userId === allowedUser,
      });

      await request(ctx.httpServer)
        .get(`/api/v1/audit-logs?entityType=widgets&entityId=${entityId}`)
        .set(withAuth([], { userId: allowedUser }))
        .expect(200);

      await request(ctx.httpServer)
        .get(`/api/v1/audit-logs?entityType=widgets&entityId=${entityId}`)
        .set(withAuth([], { userId: deniedUser }))
        .expect(403);
    });

    it('falls back to audit.read_all when no authoriseRead is registered', async () => {
      const entityId = randomUUID();
      await seedAuditLog({ entityType: 'unregistered-thing', entityId });

      await request(ctx.httpServer)
        .get(`/api/v1/audit-logs?entityType=unregistered-thing&entityId=${entityId}`)
        .set(withAuth([]))
        .expect(403);

      await request(ctx.httpServer)
        .get(`/api/v1/audit-logs?entityType=unregistered-thing&entityId=${entityId}`)
        .set(withAuth(READ_ALL))
        .expect(200);
    });

    it('authoriseRead can be async', async () => {
      const entityId = randomUUID();
      await seedAuditLog({ entityType: 'gadgets', entityId });

      registry.register('gadgets', {
        events: '*',
        authoriseRead: async () => Promise.resolve(true),
      });

      await request(ctx.httpServer)
        .get(`/api/v1/audit-logs?entityType=gadgets&entityId=${entityId}`)
        .set(withAuth([]))
        .expect(200);
    });
  });

  describe('GET /api/v1/audit-logs/:id', () => {
    it('returns a single audit log when caller can read the subject entity', async () => {
      const entityId = randomUUID();
      const log = await seedAuditLog({ entityType: 'widgets', entityId, action: 'deleted' });
      registry.register('widgets', {
        events: '*',
        authoriseRead: () => true,
      });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/audit-logs/${log.id}`)
        .set(withAuth([]))
        .expect(200);

      expect(res.body.entityType).toBe('widgets');
      expect(res.body.action).toBe('deleted');
    });

    it('403 when authoriseRead denies', async () => {
      const entityId = randomUUID();
      const log = await seedAuditLog({ entityType: 'widgets', entityId });
      registry.register('widgets', {
        events: '*',
        authoriseRead: () => false,
      });

      await request(ctx.httpServer)
        .get(`/api/v1/audit-logs/${log.id}`)
        .set(withAuth([]))
        .expect(403);
    });

    it('404 for non-existent log (before permission check)', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/audit-logs/${randomUUID()}`)
        .set(withAuth(READ_ALL))
        .expect(404);
    });
  });

  describe('Auth enforcement', () => {
    it('401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/audit-logs')
        .expect(401);
    });
  });
});
