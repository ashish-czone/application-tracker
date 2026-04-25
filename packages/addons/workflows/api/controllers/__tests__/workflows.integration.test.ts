import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Global, Module } from '@nestjs/common';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { FeatureDeriverRegistry, featureDeriverRegistry } from '@packages/entity-engine';
import { WorkflowsModule } from '../../workflows.module';

// Mirror EntityCoreModule's @Global FeatureDeriverRegistry binding so
// WorkflowsModule (which depends on it) can resolve the provider.
@Global()
@Module({
  providers: [{ provide: FeatureDeriverRegistry, useValue: featureDeriverRegistry }],
  exports: [FeatureDeriverRegistry],
})
class MockEntityCoreModule {}
import { WORKFLOWS_PERMISSIONS } from '../../permissions';

const READ = [WORKFLOWS_PERMISSIONS.READ];
const MANAGE = [...READ, WORKFLOWS_PERMISSIONS.MANAGE];

describe('WorkflowsController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [MockEntityCoreModule, WorkflowsModule],
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

  async function createWorkflow(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      slug: `order-status-${Date.now()}-${seq}`,
      name: 'Order Status',
      entityType: 'orders',
      fieldName: 'status',
      initialState: 'pending',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/workflows')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  async function createState(
    definitionId: string,
    overrides: Record<string, unknown> = {},
  ) {
    seq++;
    const body = {
      name: `state-${Date.now()}-${seq}`,
      label: 'Some State',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post(`/api/v1/workflows/${definitionId}/states`)
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  async function createTransition(
    definitionId: string,
    fromStateId: string,
    toStateId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const body = {
      fromStateId,
      toStateId,
      name: 'Approve',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post(`/api/v1/workflows/${definitionId}/transitions`)
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── Workflow Definitions: CRUD ──────────────────────────────

  describe('POST /api/v1/workflows', () => {
    it('should create a workflow definition', async () => {
      const wf = await createWorkflow({
        slug: 'candidate-pipeline',
        name: 'Candidate Pipeline',
        entityType: 'candidates',
        fieldName: 'status',
        initialState: 'new',
      });

      expect(wf).toMatchObject({
        id: expect.any(String),
        slug: 'candidate-pipeline',
        name: 'Candidate Pipeline',
        entityType: 'candidates',
        fieldName: 'status',
        initialState: 'new',
      });
    });

    it('should reject missing slug', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/workflows')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', entityType: 'test', fieldName: 'status', initialState: 'new' })
        .expect(400);
    });

    it('should reject invalid slug format', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/workflows')
        .set(withAuth(MANAGE))
        .send({ slug: 'Invalid Slug', name: 'Test', entityType: 'test', fieldName: 'status', initialState: 'new' })
        .expect(400);
    });

    it('should reject missing required fields', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/workflows')
        .set(withAuth(MANAGE))
        .send({ slug: 'test' })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/workflows')
        .set(withAuth(MANAGE))
        .send({
          slug: 'test',
          name: 'Test',
          entityType: 'test',
          fieldName: 'status',
          initialState: 'new',
          hackField: 'injected',
        })
        .expect(400);
    });

    it('should accept optional discriminator fields', async () => {
      const wf = await createWorkflow({
        slug: 'order-uk',
        discriminatorKey: 'client-country',
        discriminatorValue: 'UK',
        isDefault: false,
      });

      expect(wf).toMatchObject({
        discriminatorKey: 'client-country',
        discriminatorValue: 'UK',
        isDefault: false,
      });
    });
  });

  describe('GET /api/v1/workflows', () => {
    it('should list all workflow definitions', async () => {
      await createWorkflow({ slug: 'wf-alpha', name: 'Alpha' });
      await createWorkflow({ slug: 'wf-beta', name: 'Beta' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/workflows')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/v1/workflows/:slug', () => {
    it('should return a workflow by slug with states and transitions', async () => {
      const wf = await createWorkflow({ slug: 'lookup-wf', name: 'Lookup WF' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/workflows/${wf.slug}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({
        slug: 'lookup-wf',
        name: 'Lookup WF',
      });
    });

    it('should return 404 for non-existent slug', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/workflows/nonexistent-slug')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/workflows/:id', () => {
    it('should update a workflow name', async () => {
      const wf = await createWorkflow();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/workflows/${wf.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('should return 400 for invalid UUID', async () => {
      await request(ctx.httpServer)
        .patch('/api/v1/workflows/not-a-uuid')
        .set(withAuth(MANAGE))
        .send({ name: 'Test' })
        .expect(400);
    });
  });

  describe('DELETE /api/v1/workflows/:id', () => {
    it('should soft-delete a workflow', async () => {
      const wf = await createWorkflow();

      await request(ctx.httpServer)
        .delete(`/api/v1/workflows/${wf.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      // After deletion, the slug lookup should return 404
      await request(ctx.httpServer)
        .get(`/api/v1/workflows/${wf.slug}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── States: CRUD ────────────────────────────────────────────

  describe('POST /api/v1/workflows/:id/states', () => {
    it('should create a state in a workflow', async () => {
      const wf = await createWorkflow();
      const state = await createState(wf.id, { name: 'pending', label: 'Pending', color: '#F59E0B' });

      expect(state).toMatchObject({
        id: expect.any(String),
        name: 'pending',
        label: 'Pending',
        color: '#F59E0B',
      });
    });

    it('should reject missing name', async () => {
      const wf = await createWorkflow();

      await request(ctx.httpServer)
        .post(`/api/v1/workflows/${wf.id}/states`)
        .set(withAuth(MANAGE))
        .send({ label: 'Pending' })
        .expect(400);
    });

    it('should reject missing label', async () => {
      const wf = await createWorkflow();

      await request(ctx.httpServer)
        .post(`/api/v1/workflows/${wf.id}/states`)
        .set(withAuth(MANAGE))
        .send({ name: 'pending' })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/workflows/states/:id', () => {
    it('should update a state label', async () => {
      const wf = await createWorkflow();
      const state = await createState(wf.id, { name: 'draft', label: 'Draft' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/workflows/states/${state.id}`)
        .set(withAuth(MANAGE))
        .send({ label: 'Updated Label' })
        .expect(200);

      expect(res.body.label).toBe('Updated Label');
    });

    it('should update state color', async () => {
      const wf = await createWorkflow();
      const state = await createState(wf.id, { name: 'active', label: 'Active' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/workflows/states/${state.id}`)
        .set(withAuth(MANAGE))
        .send({ color: '#22C55E' })
        .expect(200);

      expect(res.body.color).toBe('#22C55E');
    });
  });

  describe('DELETE /api/v1/workflows/states/:id', () => {
    it('should delete a state', async () => {
      const wf = await createWorkflow();
      const state = await createState(wf.id, { name: 'temp', label: 'Temporary' });

      await request(ctx.httpServer)
        .delete(`/api/v1/workflows/states/${state.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });
  });

  // ── Transitions: CRUD ───────────────────────────────────────

  describe('POST /api/v1/workflows/:id/transitions', () => {
    it('should create a transition between states', async () => {
      const wf = await createWorkflow();
      const from = await createState(wf.id, { name: 'pending', label: 'Pending' });
      const to = await createState(wf.id, { name: 'approved', label: 'Approved' });

      const transition = await createTransition(wf.id, from.id, to.id, { name: 'Approve' });

      expect(transition).toMatchObject({
        id: expect.any(String),
        fromStateId: from.id,
        toStateId: to.id,
        name: 'Approve',
      });
    });

    it('should accept optional fields', async () => {
      const wf = await createWorkflow();
      const from = await createState(wf.id, { name: 'review', label: 'Review' });
      const to = await createState(wf.id, { name: 'rejected', label: 'Rejected' });

      const transition = await createTransition(wf.id, from.id, to.id, {
        name: 'Reject',
        requiredPermissions: ['orders.approve'],
        reasonRequired: true,
        reasonOptions: ['Not qualified', 'Salary mismatch'],
        commentRequired: false,
      });

      expect(transition).toMatchObject({
        name: 'Reject',
        reasonRequired: true,
        commentRequired: false,
      });
    });

    it('should reject missing fromStateId', async () => {
      const wf = await createWorkflow();
      const to = await createState(wf.id, { name: 'done', label: 'Done' });

      await request(ctx.httpServer)
        .post(`/api/v1/workflows/${wf.id}/transitions`)
        .set(withAuth(MANAGE))
        .send({ toStateId: to.id, name: 'Go' })
        .expect(400);
    });

    it('should reject missing name', async () => {
      const wf = await createWorkflow();
      const from = await createState(wf.id, { name: 'a', label: 'A' });
      const to = await createState(wf.id, { name: 'b', label: 'B' });

      await request(ctx.httpServer)
        .post(`/api/v1/workflows/${wf.id}/transitions`)
        .set(withAuth(MANAGE))
        .send({ fromStateId: from.id, toStateId: to.id })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/workflows/transitions/:id', () => {
    it('should update a transition name', async () => {
      const wf = await createWorkflow();
      const from = await createState(wf.id, { name: 'start', label: 'Start' });
      const to = await createState(wf.id, { name: 'end', label: 'End' });
      const transition = await createTransition(wf.id, from.id, to.id, { name: 'Complete' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/workflows/transitions/${transition.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'Finish' })
        .expect(200);

      expect(res.body.name).toBe('Finish');
    });
  });

  describe('DELETE /api/v1/workflows/transitions/:id', () => {
    it('should delete a transition', async () => {
      const wf = await createWorkflow();
      const from = await createState(wf.id, { name: 'x', label: 'X' });
      const to = await createState(wf.id, { name: 'y', label: 'Y' });
      const transition = await createTransition(wf.id, from.id, to.id, { name: 'Go' });

      await request(ctx.httpServer)
        .delete(`/api/v1/workflows/transitions/${transition.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/workflows')
        .expect(401);
    });

    it('should return 403 with read-only on write endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/workflows')
        .set(withAuth(READ))
        .send({
          slug: 'test',
          name: 'Test',
          entityType: 'test',
          fieldName: 'status',
          initialState: 'new',
        })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/workflows')
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
