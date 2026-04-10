import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { AuditModule } from '../../audit.module';
import { AUDIT_PERMISSIONS } from '../../permissions';

const READ = [AUDIT_PERMISSIONS.READ];

describe('AuditLogsController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [AuditModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
  });

  // ── Helpers ──────────────────────────────────────────────────

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

  // ── List ──────────────────────────────────────────────────

  describe('GET /api/v1/audit-logs', () => {
    it('should return empty list when no logs exist', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should list audit logs', async () => {
      await seedAuditLog();
      await seedAuditLog();

      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should filter by entityType', async () => {
      await seedAuditLog({ entityType: 'candidates' });
      await seedAuditLog({ entityType: 'orders' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs?entityType=candidates')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].entityType).toBe('candidates');
    });

    it('should filter by eventName', async () => {
      await seedAuditLog({ eventName: 'candidates.CandidateCreated' });
      await seedAuditLog({ eventName: 'candidates.CandidateUpdated' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs?eventName=candidates.CandidateUpdated')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].eventName).toBe('candidates.CandidateUpdated');
    });

    it('should filter by action', async () => {
      await seedAuditLog({ action: 'created' });
      await seedAuditLog({ action: 'updated' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs?action=updated')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('updated');
    });

    it('should paginate', async () => {
      for (let i = 0; i < 5; i++) {
        await seedAuditLog();
      }

      const res = await request(ctx.httpServer)
        .get('/api/v1/audit-logs?page=2&limit=2')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.page).toBe(2);
    });
  });

  // ── Find one ──────────────────────────────────────────────────

  describe('GET /api/v1/audit-logs/:id', () => {
    it('should return a single audit log by id', async () => {
      const log = await seedAuditLog({ entityType: 'orders', action: 'deleted' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/audit-logs/${log.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.entityType).toBe('orders');
      expect(res.body.action).toBe('deleted');
    });

    it('should 404 for non-existent log', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/audit-logs/${randomUUID()}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/audit-logs')
        .expect(401);
    });
  });
});
