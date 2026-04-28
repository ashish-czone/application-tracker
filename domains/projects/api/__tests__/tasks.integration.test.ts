import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { withAuth, type TestAppContext } from '@packages/platform-testing';
import { TasksService } from '../tasks/tasks.service';
import { createProjectsTestApp, resetProjectsTestDb } from './setup/app';
import {
  createFeature,
  createMilestone,
  createProject,
  createProjectTree,
  createTask,
  createUser,
} from './setup/fixtures';
import { tasks } from '../schema/tasks';

const READ = ['tasks.read'];
const MANAGE = ['tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete'];

describe('Tasks (integration)', () => {
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

  async function freshFeature() {
    const project = await createProject(ctx.db, 'test-actor');
    const m = await createMilestone(ctx.db, project.id, 'test-actor');
    return createFeature(ctx.db, m.id, 'test-actor');
  }

  describe('POST /api/v1/tasks', () => {
    it('creates a task under a feature', async () => {
      const f = await freshFeature();
      const res = await request(ctx.httpServer)
        .post('/api/v1/tasks')
        .set(withAuth(MANAGE))
        .send({ featureId: f.id, title: 'Wire up CTA tracking' })
        .expect(201);
      expect(res.body).toMatchObject({
        featureId: f.id,
        title: 'Wire up CTA tracking',
        status: 'todo',
      });
    });

    it('rejects missing title', async () => {
      const f = await freshFeature();
      await request(ctx.httpServer)
        .post('/api/v1/tasks')
        .set(withAuth(MANAGE))
        .send({ featureId: f.id })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      const f = await freshFeature();
      await request(ctx.httpServer)
        .post('/api/v1/tasks')
        .send({ featureId: f.id, title: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      const f = await freshFeature();
      await request(ctx.httpServer)
        .post('/api/v1/tasks')
        .set(withAuth(READ))
        .send({ featureId: f.id, title: 'X' })
        .expect(403);
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('updates a task', async () => {
      const f = await freshFeature();
      const t = await createTask(ctx.db, f.id, 'test-actor');
      const res = await request(ctx.httpServer)
        .patch(`/api/v1/tasks/${t.id}`)
        .set(withAuth(MANAGE))
        .send({ description: 'Refined' })
        .expect(200);
      expect(res.body.description).toBe('Refined');
    });

    it('returns 403 with read-only perms', async () => {
      const f = await freshFeature();
      const t = await createTask(ctx.db, f.id, 'test-actor');
      await request(ctx.httpServer)
        .patch(`/api/v1/tasks/${t.id}`)
        .set(withAuth(READ))
        .send({ description: 'X' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('soft-deletes the task', async () => {
      const f = await freshFeature();
      const t = await createTask(ctx.db, f.id, 'test-actor');
      await request(ctx.httpServer)
        .delete(`/api/v1/tasks/${t.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
      await request(ctx.httpServer)
        .get(`/api/v1/tasks/${t.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('POST /api/v1/tasks/:id/transition', () => {
    it('flips completedAt when transitioning to done', async () => {
      const tree = await createProjectTree(ctx.db, 'test-actor', 1);
      const taskId = tree.taskIds[0];

      await request(ctx.httpServer)
        .post(`/api/v1/tasks/${taskId}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'done' })
        .expect(201);

      const [row] = await ctx.db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(row.status).toBe('done');
      expect(row.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when transitioning back from done', async () => {
      const tree = await createProjectTree(ctx.db, 'test-actor', 1);
      const taskId = tree.taskIds[0];

      // Round-trip: todo → done (sets completedAt) → todo (clears it)
      await request(ctx.httpServer)
        .post(`/api/v1/tasks/${taskId}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'done' })
        .expect(201);
      await request(ctx.httpServer)
        .post(`/api/v1/tasks/${taskId}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'todo' })
        .expect(201);

      const [row] = await ctx.db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(row.status).toBe('todo');
      expect(row.completedAt).toBeNull();
    });

    it('rejects an invalid transition', async () => {
      const tree = await createProjectTree(ctx.db, 'test-actor', 1);
      // todo → in_review is not a configured transition.
      await request(ctx.httpServer)
        .post(`/api/v1/tasks/${tree.taskIds[0]}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'in_review' })
        .expect(422);
    });

    it('returns 403 with read-only perms', async () => {
      const tree = await createProjectTree(ctx.db, 'test-actor', 1);
      await request(ctx.httpServer)
        .post(`/api/v1/tasks/${tree.taskIds[0]}/transition`)
        .set(withAuth(READ))
        .send({ fieldKey: 'status', to: 'done' })
        .expect(403);
    });
  });

  describe('TasksService.listForAssignee', () => {
    it('returns tasks for the given assignee, joined with parent context', async () => {
      const user = await createUser(ctx.db);
      const project = await createProject(ctx.db, user.id, { name: 'Owned Project' });
      const m = await createMilestone(ctx.db, project.id, user.id, { name: 'M1' });
      const f = await createFeature(ctx.db, m.id, user.id, { name: 'F1' });
      await createTask(ctx.db, f.id, user.id, { title: 'Mine A', assigneeId: user.id });
      await createTask(ctx.db, f.id, user.id, { title: 'Mine B', assigneeId: user.id });
      // Unassigned (must be excluded):
      await createTask(ctx.db, f.id, user.id, { title: 'Unowned' });

      const tasksService = ctx.module.get(TasksService);
      const rows = await tasksService.listForAssignee(user.id);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        projectName: 'Owned Project',
        milestoneName: 'M1',
        featureName: 'F1',
      });
      expect(rows.map((r) => r.title).sort()).toEqual(['Mine A', 'Mine B']);
    });

    it('excludes tasks whose parent project/milestone/feature is soft-deleted', async () => {
      const user = await createUser(ctx.db);
      const project = await createProject(ctx.db, user.id);
      const m = await createMilestone(ctx.db, project.id, user.id);
      const fLive = await createFeature(ctx.db, m.id, user.id);
      const fDead = await createFeature(ctx.db, m.id, user.id, {
        deletedAt: new Date(),
        deletedBy: user.id,
      });
      await createTask(ctx.db, fLive.id, user.id, {
        title: 'Visible',
        assigneeId: user.id,
      });
      await createTask(ctx.db, fDead.id, user.id, {
        title: 'Hidden by feature delete',
        assigneeId: user.id,
      });

      const tasksService = ctx.module.get(TasksService);
      const rows = await tasksService.listForAssignee(user.id);

      expect(rows.map((r) => r.title)).toEqual(['Visible']);
    });
  });
});
