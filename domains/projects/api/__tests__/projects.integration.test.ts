import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type TestAppContext } from '@packages/platform-testing';
import { createProjectsTestApp, resetProjectsTestDb } from './setup/app';
import { createProject } from './setup/fixtures';

const READ = ['projects.read'];
const MANAGE = ['projects.read', 'projects.create', 'projects.update', 'projects.delete'];

describe('Projects (integration)', () => {
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

  let seq = 0;
  const unique = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`;

  describe('POST /api/v1/projects', () => {
    it('creates a project with required fields', async () => {
      const slug = unique('proj');
      const res = await request(ctx.httpServer)
        .post('/api/v1/projects')
        .set(withAuth(MANAGE))
        .send({ name: 'Test Project', slug, priority: 'high' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Project',
        slug,
        priority: 'high',
        status: 'planning',
      });
    });

    it('rejects missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/projects')
        .set(withAuth(MANAGE))
        .send({ slug: unique('proj'), priority: 'medium' })
        .expect(400);
    });

    it('rejects duplicate slug', async () => {
      const slug = unique('dup');
      await request(ctx.httpServer)
        .post('/api/v1/projects')
        .set(withAuth(MANAGE))
        .send({ name: 'First', slug, priority: 'medium' })
        .expect(201);
      await request(ctx.httpServer)
        .post('/api/v1/projects')
        .set(withAuth(MANAGE))
        .send({ name: 'Second', slug, priority: 'medium' })
        .expect(409);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/projects')
        .send({ name: 'X', slug: unique('x'), priority: 'low' })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/projects')
        .set(withAuth(READ))
        .send({ name: 'X', slug: unique('x'), priority: 'low' })
        .expect(403);
    });
  });

  describe('GET /api/v1/projects', () => {
    it('lists projects', async () => {
      const actor = withAuth(READ);
      // Two fixtures so we can verify list returns both.
      await createProject(ctx.db, 'test-actor', { slug: unique('p-a') });
      await createProject(ctx.db, 'test-actor', { slug: unique('p-b') });

      const res = await request(ctx.httpServer)
        .get('/api/v1/projects')
        .set(actor)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/projects').expect(401);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('returns the project', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const res = await request(ctx.httpServer)
        .get(`/api/v1/projects/${project.id}`)
        .set(withAuth(READ))
        .expect(200);
      expect(res.body).toMatchObject({ id: project.id, slug: project.slug });
    });

    it('returns 404 for unknown id', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/projects/00000000-0000-4000-8000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });

    it('returns 401 without auth', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      await request(ctx.httpServer).get(`/api/v1/projects/${project.id}`).expect(401);
    });
  });

  describe('PATCH /api/v1/projects/:id', () => {
    it('updates a project', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      const res = await request(ctx.httpServer)
        .patch(`/api/v1/projects/${project.id}`)
        .set(withAuth(MANAGE))
        .send({ description: 'Updated desc' })
        .expect(200);
      expect(res.body.description).toBe('Updated desc');
    });

    it('returns 403 with read-only perms', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      await request(ctx.httpServer)
        .patch(`/api/v1/projects/${project.id}`)
        .set(withAuth(READ))
        .send({ description: 'X' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('soft-deletes the project', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      await request(ctx.httpServer)
        .delete(`/api/v1/projects/${project.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      // Soft-deleted: 404 by default, visible with includeDeleted
      await request(ctx.httpServer)
        .get(`/api/v1/projects/${project.id}`)
        .set(withAuth(READ))
        .expect(404);
    });

    it('returns 403 without delete perm', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      await request(ctx.httpServer)
        .delete(`/api/v1/projects/${project.id}`)
        .set(withAuth(['projects.read', 'projects.update']))
        .expect(403);
    });
  });

  describe('POST /api/v1/projects/:id/transition', () => {
    it('transitions status from planning to active', async () => {
      const project = await createProject(ctx.db, 'test-actor', { status: 'planning' });
      const res = await request(ctx.httpServer)
        .post(`/api/v1/projects/${project.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);
      expect(res.body.status).toBe('active');
    });

    it('rejects an invalid transition', async () => {
      const project = await createProject(ctx.db, 'test-actor', { status: 'planning' });
      // 422 — transition is well-formed but the workflow doesn't allow
      // planning → completed; the engine reports a semantic violation rather
      // than a request-shape error.
      await request(ctx.httpServer)
        .post(`/api/v1/projects/${project.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'completed' })
        .expect(422);
    });

    it('returns 403 with read-only perms', async () => {
      const project = await createProject(ctx.db, 'test-actor');
      await request(ctx.httpServer)
        .post(`/api/v1/projects/${project.id}/transition`)
        .set(withAuth(READ))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(403);
    });
  });
});
