import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { AutomationsModule } from '../../automations.module';
import { AUTOMATION_PERMISSIONS } from '../../permissions';

const READ = [AUTOMATION_PERMISSIONS.RULES_READ];
const MANAGE = [...READ, AUTOMATION_PERMISSIONS.RULES_MANAGE];

describe('AutomationRulesController (integration)', () => {
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

  async function createRule(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: `Rule ${Date.now()}-${seq}`,
      triggerType: 'event',
      eventName: 'candidates.CandidateCreated',
      actions: [
        {
          type: 'send_notification',
          config: { templateSlug: 'test-template' },
        },
      ],
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/automation-rules')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ──────────────────────────────────────────────────

  describe('POST /api/v1/automation-rules', () => {
    it('should create an event-triggered rule', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/automation-rules')
        .set(withAuth(MANAGE))
        .send({
          name: 'Interview Follow-up',
          triggerType: 'event',
          eventName: 'interviews.InterviewScheduled',
          actions: [
            { type: 'send_notification', config: { templateSlug: 'follow-up' } },
          ],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Interview Follow-up',
        triggerType: 'event',
        eventName: 'interviews.InterviewScheduled',
        isActive: true,
      });
    });

    it('should create a rule with conditions', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/automation-rules')
        .set(withAuth(MANAGE))
        .send({
          name: 'Conditional Rule',
          triggerType: 'event',
          eventName: 'orders.OrderCreated',
          conditions: [
            { field: 'status', operator: 'eq', value: 'pending' },
          ],
          actions: [
            { type: 'send_notification', config: { templateSlug: 'notify' } },
          ],
        })
        .expect(201);

      expect(res.body.conditions).toHaveLength(1);
      expect(res.body.conditions[0]).toMatchObject({
        field: 'status',
        operator: 'eq',
        value: 'pending',
      });
    });

    it('should create a rule with delay', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/automation-rules')
        .set(withAuth(MANAGE))
        .send({
          name: 'Delayed Rule',
          triggerType: 'event',
          eventName: 'candidates.CandidateCreated',
          delayAmount: 2,
          delayUnit: 'hours',
          actions: [
            { type: 'send_notification', config: {} },
          ],
        })
        .expect(201);

      expect(res.body.delayAmount).toBe(2);
      expect(res.body.delayUnit).toBe('hours');
    });
  });

  describe('GET /api/v1/automation-rules', () => {
    it('should list rules', async () => {
      await createRule({ name: 'Rule A' });
      await createRule({ name: 'Rule B' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-rules')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should search by name', async () => {
      await createRule({ name: 'Follow-up Reminder' });
      await createRule({ name: 'Onboarding Task' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-rules?search=Follow')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Follow-up Reminder');
    });

    it('should filter by eventName', async () => {
      await createRule({ eventName: 'candidates.CandidateCreated' });
      await createRule({ eventName: 'orders.OrderCreated' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-rules?eventName=orders.OrderCreated')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
    });

    it('should paginate', async () => {
      for (let i = 0; i < 5; i++) {
        await createRule();
      }

      const res = await request(ctx.httpServer)
        .get('/api/v1/automation-rules?page=1&limit=2')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(5);
    });
  });

  describe('GET /api/v1/automation-rules/:id', () => {
    it('should get a rule by id', async () => {
      const rule = await createRule({ name: 'Specific Rule' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/automation-rules/${rule.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.name).toBe('Specific Rule');
    });

    it('should 404 for non-existent rule', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/automation-rules/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/automation-rules/:id', () => {
    it('should update a rule name', async () => {
      const rule = await createRule({ name: 'Old Name' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/automation-rules/${rule.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('should deactivate a rule', async () => {
      const rule = await createRule();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/automation-rules/${rule.id}`)
        .set(withAuth(MANAGE))
        .send({ isActive: false })
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });
  });

  describe('DELETE /api/v1/automation-rules/:id', () => {
    it('should delete a rule', async () => {
      const rule = await createRule();

      await request(ctx.httpServer)
        .delete(`/api/v1/automation-rules/${rule.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      // Verify deleted
      await request(ctx.httpServer)
        .get(`/api/v1/automation-rules/${rule.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/automation-rules')
        .expect(401);
    });
  });
});
