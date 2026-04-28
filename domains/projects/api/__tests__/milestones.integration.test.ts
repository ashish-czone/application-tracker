import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type TestAppContext } from '@packages/platform-testing';
import { createProjectsTestApp, resetProjectsTestDb } from './setup/app';
import { createMilestone, createProject } from './setup/fixtures';

const READ = ['milestones.read'];
const MANAGE = [
  'milestones.read',
  'milestones.create',
  'milestones.update',
  'milestones.delete',
];

describe('Milestones (integration)', () => {
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

  describe('POST /api/v1/milestones', () => {
    it('creates a milestone under a project', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const res = await request(ctx.httpServer)
        .post('/api/v1/milestones')
        .set(withAuth(MANAGE))
        .send({ projectId: project.id, name: 'Discovery' })
        .expect(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        projectId: project.id,
        name: 'Discovery',
        status: 'pending',
      });
    });

    it('rejects missing projectId', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/milestones')
        .set(withAuth(MANAGE))
        .send({ name: 'Orphan' })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      await request(ctx.httpServer)
        .post('/api/v1/milestones')
        .send({ projectId: project.id, name: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      await request(ctx.httpServer)
        .post('/api/v1/milestones')
        .set(withAuth(READ))
        .send({ projectId: project.id, name: 'X' })
        .expect(403);
    });
  });

  describe('GET /api/v1/milestones/:id', () => {
    it('returns the milestone', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const m = await createMilestone(ctx.db, project.id, 'test-actor');
      const res = await request(ctx.httpServer)
        .get(`/api/v1/milestones/${m.id}`)
        .set(withAuth(READ))
        .expect(200);
      expect(res.body.id).toBe(m.id);
    });

    it('returns 404 for unknown id', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/milestones/00000000-0000-4000-8000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/milestones/:id', () => {
    it('updates a milestone', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const m = await createMilestone(ctx.db, project.id, 'test-actor');
      const res = await request(ctx.httpServer)
        .patch(`/api/v1/milestones/${m.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'Renamed' })
        .expect(200);
      expect(res.body.name).toBe('Renamed');
    });

    it('returns 403 with read-only perms', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const m = await createMilestone(ctx.db, project.id, 'test-actor');
      await request(ctx.httpServer)
        .patch(`/api/v1/milestones/${m.id}`)
        .set(withAuth(READ))
        .send({ name: 'X' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/milestones/:id', () => {
    it('soft-deletes the milestone', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const m = await createMilestone(ctx.db, project.id, 'test-actor');
      await request(ctx.httpServer)
        .delete(`/api/v1/milestones/${m.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
      await request(ctx.httpServer)
        .get(`/api/v1/milestones/${m.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('POST /api/v1/milestones/:id/transition', () => {
    it('transitions pending → in_progress', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const m = await createMilestone(ctx.db, project.id, 'test-actor', { status: 'pending' });
      const res = await request(ctx.httpServer)
        .post(`/api/v1/milestones/${m.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'in_progress' })
        .expect(201);
      expect(res.body.status).toBe('in_progress');
    });

    it('rejects an invalid transition', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const m = await createMilestone(ctx.db, project.id, 'test-actor', { status: 'pending' });
      await request(ctx.httpServer)
        .post(`/api/v1/milestones/${m.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'completed' })
        .expect(422);
    });
  });
});
