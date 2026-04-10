import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { AutomationsModule } from '../../automations.module';
import { AUTOMATION_PERMISSIONS } from '../../permissions';

const READ = [AUTOMATION_PERMISSIONS.RULES_READ];
const MANAGE = [...READ, AUTOMATION_PERMISSIONS.RULES_MANAGE];

describe('AutomationExecutionsController (integration)', () => {
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

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createRule() {
    seq++;
    const res = await request(ctx.httpServer)
      .post('/api/v1/automation-rules')
      .set(withAuth(MANAGE))
      .send({
        name: `Rule ${Date.now()}-${seq}`,
        triggerType: 'event',
        eventName: 'candidates.CandidateCreated',
        actions: [{ type: 'send_notification', config: {} }],
      })
      .expect(201);
    return res.body;
  }

  async function seedExecution(ruleId: string, overrides: Record<string, unknown> = {}) {
    const id = randomUUID();
    const defaults = {
      id,
      ruleId,
      actionIndex: 0,
      actionType: 'send_notification',
      entityType: 'candidates',
      entityId: randomUUID(),
      status: 'success',
    };
    const data = { ...defaults, ...overrides };

    await ctx.db.execute(
      sql`INSERT INTO automation_executions (id, rule_id, action_index, action_type, entity_type, entity_id, status)
          VALUES (${data.id as string}, ${data.ruleId as string}, ${data.actionIndex as number}, ${data.actionType as string}, ${data.entityType as string}, ${data.entityId as string}, ${data.status as string})`,
    );
    return data;
  }

  // ── List ──────────────────────────────────────────────────

  describe('GET /api/v1/automation-executions', () => {
    it('should return empty list when no executions exist', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-executions')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should list execution logs', async () => {
      const rule = await createRule();
      await seedExecution(rule.id);
      await seedExecution(rule.id);

      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-executions')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should include rule name in response', async () => {
      const rule = await createRule();
      await seedExecution(rule.id);

      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-executions')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data[0].ruleName).toBe(rule.name);
    });

    it('should filter by status', async () => {
      const rule = await createRule();
      await seedExecution(rule.id, { status: 'success' });
      await seedExecution(rule.id, { status: 'error' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-executions?status=error')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('error');
    });

    it('should filter by ruleId', async () => {
      const rule1 = await createRule();
      const rule2 = await createRule();
      await seedExecution(rule1.id);
      await seedExecution(rule2.id);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/automation-executions?ruleId=${rule1.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
    });

    it('should paginate', async () => {
      const rule = await createRule();
      for (let i = 0; i < 5; i++) {
        await seedExecution(rule.id);
      }

      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-executions?page=1&limit=2')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(5);
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/automation-executions')
        .expect(401);
    });
  });
});
