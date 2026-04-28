import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type TestAppContext } from '@packages/platform-testing';
import { createProjectsTestApp, resetProjectsTestDb } from './setup/app';
import { createFeature, createMilestone, createProject } from './setup/fixtures';

const READ = ['features.read'];
const MANAGE = [
  'features.read',
  'features.create',
  'features.update',
  'features.delete',
];

describe('Features (integration)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createProjectsTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await resetProjectsTestDb(ctx);
  });

  async function freshMilestone() {
    const project = await createProject(ctx.db, 'test-actor');
    return createMilestone(ctx.db, project.id, 'test-actor');
  }

  describe('POST /api/v1/features', () => {
    it('creates a feature under a milestone', async () => {
      const m = await freshMilestone();
      const res = await request(ctx.httpServer)
        .post('/api/v1/features')
        .set(withAuth(MANAGE))
        .send({ milestoneId: m.id, name: 'Welcome screen', priority: 'high' })
        .expect(201);
      expect(res.body).toMatchObject({
        milestoneId: m.id,
        name: 'Welcome screen',
        priority: 'high',
        status: 'backlog',
      });
    });

    it('rejects missing name', async () => {
      const m = await freshMilestone();
      await request(ctx.httpServer)
        .post('/api/v1/features')
        .set(withAuth(MANAGE))
        .send({ milestoneId: m.id })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      const m = await freshMilestone();
      await request(ctx.httpServer)
        .post('/api/v1/features')
        .send({ milestoneId: m.id, name: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      const m = await freshMilestone();
      await request(ctx.httpServer)
        .post('/api/v1/features')
        .set(withAuth(READ))
        .send({ milestoneId: m.id, name: 'X' })
        .expect(403);
    });
  });

  describe('GET /api/v1/features/:id', () => {
    it('returns the feature', async () => {
      const m = await freshMilestone();
      const f = await createFeature(ctx.db, m.id, 'test-actor');
      const res = await request(ctx.httpServer)
        .get(`/api/v1/features/${f.id}`)
        .set(withAuth(READ))
        .expect(200);
      expect(res.body.id).toBe(f.id);
    });
  });

  describe('PATCH /api/v1/features/:id', () => {
    it('updates a feature', async () => {
      const m = await freshMilestone();
      const f = await createFeature(ctx.db, m.id, 'test-actor');
      const res = await request(ctx.httpServer)
        .patch(`/api/v1/features/${f.id}`)
        .set(withAuth(MANAGE))
        .send({ priority: 'low' })
        .expect(200);
      expect(res.body.priority).toBe('low');
    });

    it('returns 403 with read-only perms', async () => {
      const m = await freshMilestone();
      const f = await createFeature(ctx.db, m.id, 'test-actor');
      await request(ctx.httpServer)
        .patch(`/api/v1/features/${f.id}`)
        .set(withAuth(READ))
        .send({ priority: 'low' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/features/:id', () => {
    it('soft-deletes the feature', async () => {
      const m = await freshMilestone();
      const f = await createFeature(ctx.db, m.id, 'test-actor');
      await request(ctx.httpServer)
        .delete(`/api/v1/features/${f.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
      await request(ctx.httpServer)
        .get(`/api/v1/features/${f.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('POST /api/v1/features/:id/transition', () => {
    it('transitions backlog → in_progress', async () => {
      const m = await freshMilestone();
      const f = await createFeature(ctx.db, m.id, 'test-actor', { status: 'backlog' });
      const res = await request(ctx.httpServer)
        .post(`/api/v1/features/${f.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'in_progress' })
        .expect(201);
      expect(res.body.status).toBe('in_progress');
    });

    it('rejects an invalid transition', async () => {
      const m = await freshMilestone();
      const f = await createFeature(ctx.db, m.id, 'test-actor', { status: 'backlog' });
      await request(ctx.httpServer)
        .post(`/api/v1/features/${f.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'done' })
        .expect(422);
    });
  });
});
