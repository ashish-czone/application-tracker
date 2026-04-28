import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type TestAppContext } from '@packages/platform-testing';
import { DashboardService } from '../dashboard/dashboard.service';
import { createProjectsTestApp, resetProjectsTestDb } from './setup/app';
import {
  createFeature,
  createMilestone,
  createProject,
  createTask,
} from './setup/fixtures';

const DASHBOARD_READ = ['projects-dashboard.read'];

describe('Dashboard (integration)', () => {
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

  describe('GET /api/v1/projects-dashboard', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/projects-dashboard').expect(401);
    });

    it('returns 403 without dashboard perm', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/projects-dashboard')
        .set(withAuth(['projects.read']))
        .expect(403);
    });

    it('lists every live project with rolled-up counts', async () => {
      const p1 = await createProject(ctx.db, 'test-actor', { name: 'Alpha' });
      const m1 = await createMilestone(ctx.db, p1.id, 'test-actor');
      const f1 = await createFeature(ctx.db, m1.id, 'test-actor');
      await createTask(ctx.db, f1.id, 'test-actor', { status: 'done' });
      await createTask(ctx.db, f1.id, 'test-actor', { status: 'done' });
      await createTask(ctx.db, f1.id, 'test-actor', { status: 'todo' });
      await createTask(ctx.db, f1.id, 'test-actor', { status: 'in_progress' });

      const p2 = await createProject(ctx.db, 'test-actor', { name: 'Beta' });
      const m2 = await createMilestone(ctx.db, p2.id, 'test-actor');
      const f2 = await createFeature(ctx.db, m2.id, 'test-actor');
      await createTask(ctx.db, f2.id, 'test-actor', { status: 'todo' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/projects-dashboard')
        .set(withAuth(DASHBOARD_READ))
        .expect(200);

      expect(res.body).toHaveLength(2);
      const alpha = res.body.find((r: { name: string }) => r.name === 'Alpha');
      expect(alpha).toMatchObject({
        taskCount: 4,
        doneTaskCount: 2,
        percentComplete: 50, // 2/4
        milestoneCount: 1,
      });
      const beta = res.body.find((r: { name: string }) => r.name === 'Beta');
      expect(beta).toMatchObject({
        taskCount: 1,
        doneTaskCount: 0,
        percentComplete: 0,
      });
    });

    it('counts overdue (non-done with past dueDate)', async () => {
      const p = await createProject(ctx.db, 'test-actor');
      const m = await createMilestone(ctx.db, p.id, 'test-actor');
      const f = await createFeature(ctx.db, m.id, 'test-actor');
      await createTask(ctx.db, f.id, 'test-actor', {
        status: 'todo',
        dueDate: '2020-01-01',
      });
      await createTask(ctx.db, f.id, 'test-actor', {
        status: 'in_progress',
        dueDate: '2020-01-02',
      });
      // Past due but already done — must NOT count as overdue.
      await createTask(ctx.db, f.id, 'test-actor', {
        status: 'done',
        dueDate: '2020-01-03',
      });

      const res = await request(ctx.httpServer)
        .get('/api/v1/projects-dashboard')
        .set(withAuth(DASHBOARD_READ))
        .expect(200);

      expect(res.body[0].overdueTaskCount).toBe(2);
    });

    it('handles a project with zero tasks', async () => {
      await createProject(ctx.db, 'test-actor', { name: 'Empty' });
      const res = await request(ctx.httpServer)
        .get('/api/v1/projects-dashboard')
        .set(withAuth(DASHBOARD_READ))
        .expect(200);
      expect(res.body[0]).toMatchObject({
        name: 'Empty',
        taskCount: 0,
        doneTaskCount: 0,
        percentComplete: 0,
        milestoneCount: 0,
      });
    });
  });

  describe('GET /api/v1/projects-dashboard/:id/summary', () => {
    it('returns 404 for unknown id', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/projects-dashboard/00000000-0000-4000-8000-000000000000/summary')
        .set(withAuth(['projects.read']))
        .expect(404);
    });

    it('returns the full project tree with rolled-up percentComplete at every level', async () => {
      const p = await createProject(ctx.db, 'test-actor', { name: 'Tree' });
      const m = await createMilestone(ctx.db, p.id, 'test-actor', { name: 'M1' });
      const f = await createFeature(ctx.db, m.id, 'test-actor', { name: 'F1' });
      await createTask(ctx.db, f.id, 'test-actor', { status: 'done', title: 'T1' });
      await createTask(ctx.db, f.id, 'test-actor', { status: 'done', title: 'T2' });
      await createTask(ctx.db, f.id, 'test-actor', { status: 'todo', title: 'T3' });
      await createTask(ctx.db, f.id, 'test-actor', { status: 'todo', title: 'T4' });

      const dashboard = ctx.module.get(DashboardService);
      const summary = await dashboard.getProjectSummary(p.id);

      expect(summary.percentComplete).toBe(50);
      expect(summary.taskCount).toBe(4);
      expect(summary.doneTaskCount).toBe(2);
      expect(summary.milestones).toHaveLength(1);
      const ms = summary.milestones[0];
      expect(ms.percentComplete).toBe(50);
      expect(ms.features).toHaveLength(1);
      expect(ms.features[0].percentComplete).toBe(50);
      expect(ms.features[0].tasks).toHaveLength(4);
    });

    it('throws NotFound when the project is soft-deleted', async () => {
      const p = await createProject(ctx.db, 'test-actor', {
        deletedAt: new Date(),
        deletedBy: 'test-actor',
      });
      await request(ctx.httpServer)
        .get(`/api/v1/projects-dashboard/${p.id}/summary`)
        .set(withAuth(['projects.read']))
        .expect(404);
    });
  });
});
