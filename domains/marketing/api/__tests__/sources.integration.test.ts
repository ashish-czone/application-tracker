import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type TestAppContext } from '@packages/platform-testing';
import { createMarketingTestApp, resetMarketingTestDb } from './setup/app';

const READ = ['marketing.monitoring-sources.read'];
const MANAGE = ['marketing.monitoring-sources.read', 'marketing.monitoring-sources.manage'];

describe('MonitoringSources (integration)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createMarketingTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await resetMarketingTestDb(ctx);
  });

  describe('POST /api/v1/marketing/monitoring-sources', () => {
    it('creates a Reddit source', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({
          kind: 'reddit',
          label: 'r/webdev',
          config: { subreddit: 'webdev', sort: 'new' },
          pollingCadenceMinutes: 15,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        kind: 'reddit',
        label: 'r/webdev',
        configJson: { subreddit: 'webdev', sort: 'new' },
        pollingCadenceMinutes: 15,
        isActive: true,
      });
    });

    it('creates an RSS source', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({
          kind: 'rss',
          label: 'Some blog',
          config: { url: 'https://example.com/feed.xml' },
        })
        .expect(201);

      expect(res.body.kind).toBe('rss');
      expect(res.body.pollingCadenceMinutes).toBe(60);
    });

    it('rejects invalid kind', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({ kind: 'instagram', label: 'foo', config: {} })
        .expect(400);
    });

    it('rejects missing config for kind', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({ kind: 'reddit', label: 'r/webdev', config: {} })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .send({ kind: 'reddit', label: 'x', config: { subreddit: 'x' } })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(READ))
        .send({ kind: 'reddit', label: 'x', config: { subreddit: 'x' } })
        .expect(403);
    });
  });

  describe('GET /api/v1/marketing/monitoring-sources', () => {
    it('returns paginated sources with meta.total', async () => {
      for (let i = 0; i < 3; i++) {
        await request(ctx.httpServer)
          .post('/api/v1/marketing/monitoring-sources')
          .set(withAuth(MANAGE))
          .send({
            kind: 'reddit',
            label: `r/sub-${i}`,
            config: { subreddit: `sub-${i}` },
          })
          .expect(201);
      }

      const res = await request(ctx.httpServer)
        .get('/api/v1/marketing/monitoring-sources')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta).toMatchObject({ page: 1, total: 3 });
    });

    it('filters by kind on the server', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({ kind: 'reddit', label: 'a', config: { subreddit: 'a' } })
        .expect(201);
      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({ kind: 'rss', label: 'b', config: { url: 'https://x/y' } })
        .expect(201);

      const res = await request(ctx.httpServer)
        .get('/api/v1/marketing/monitoring-sources?kind=rss')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].kind).toBe('rss');
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/marketing/monitoring-sources').expect(401);
    });
  });

  describe('PATCH /api/v1/marketing/monitoring-sources/:id', () => {
    it('updates label + cadence', async () => {
      const created = await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({ kind: 'reddit', label: 'before', config: { subreddit: 'x' } });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/marketing/monitoring-sources/${created.body.id}`)
        .set(withAuth(MANAGE))
        .send({ label: 'after', pollingCadenceMinutes: 30 })
        .expect(200);

      expect(res.body.label).toBe('after');
      expect(res.body.pollingCadenceMinutes).toBe(30);
    });

    it('returns 403 with read-only perms', async () => {
      const created = await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({ kind: 'reddit', label: 'x', config: { subreddit: 'x' } });

      await request(ctx.httpServer)
        .patch(`/api/v1/marketing/monitoring-sources/${created.body.id}`)
        .set(withAuth(READ))
        .send({ label: 'nope' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/marketing/monitoring-sources/:id', () => {
    it('soft-deletes and returns 204', async () => {
      const created = await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-sources')
        .set(withAuth(MANAGE))
        .send({ kind: 'reddit', label: 'x', config: { subreddit: 'x' } });

      await request(ctx.httpServer)
        .delete(`/api/v1/marketing/monitoring-sources/${created.body.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      // Subsequent GET 404s
      await request(ctx.httpServer)
        .get(`/api/v1/marketing/monitoring-sources/${created.body.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });
});
