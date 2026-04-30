import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type TestAppContext } from '@packages/platform-testing';
import { createMarketingTestApp, resetMarketingTestDb } from './setup/app';

const SOURCES_MANAGE = [
  'marketing.monitoring-sources.read',
  'marketing.monitoring-sources.manage',
];
const KW_READ = ['marketing.monitoring-keywords.read'];
const KW_MANAGE = [
  'marketing.monitoring-keywords.read',
  'marketing.monitoring-keywords.manage',
];

describe('MonitoringKeywords (integration)', () => {
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

  async function createSource(): Promise<string> {
    const res = await request(ctx.httpServer)
      .post('/api/v1/marketing/monitoring-sources')
      .set(withAuth(SOURCES_MANAGE))
      .send({ kind: 'reddit', label: 'r/x', config: { subreddit: 'x' } })
      .expect(201);
    return res.body.id;
  }

  describe('POST /api/v1/marketing/monitoring-keywords', () => {
    it('creates a substring keyword', async () => {
      const sourceId = await createSource();

      const res = await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-keywords')
        .set(withAuth(KW_MANAGE))
        .send({ sourceId, phrase: 'need developer', isRegex: false })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        sourceId,
        phrase: 'need developer',
        isRegex: false,
        isActive: true,
      });
    });

    it('rejects when sourceId does not exist', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-keywords')
        .set(withAuth(KW_MANAGE))
        .send({
          sourceId: '00000000-0000-0000-0000-000000000000',
          phrase: 'foo',
          isRegex: false,
        })
        .expect(400);
    });

    it('rejects invalid regex when isRegex=true', async () => {
      const sourceId = await createSource();

      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-keywords')
        .set(withAuth(KW_MANAGE))
        .send({ sourceId, phrase: '[unclosed', isRegex: true })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      const sourceId = await createSource();

      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-keywords')
        .send({ sourceId, phrase: 'x', isRegex: false })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      const sourceId = await createSource();

      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-keywords')
        .set(withAuth(KW_READ))
        .send({ sourceId, phrase: 'x', isRegex: false })
        .expect(403);
    });
  });

  describe('GET /api/v1/marketing/monitoring-keywords', () => {
    it('filters by sourceId on the server', async () => {
      const a = await createSource();
      const b = await createSource();

      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-keywords')
        .set(withAuth(KW_MANAGE))
        .send({ sourceId: a, phrase: 'react', isRegex: false });
      await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-keywords')
        .set(withAuth(KW_MANAGE))
        .send({ sourceId: b, phrase: 'vue', isRegex: false });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/marketing/monitoring-keywords?sourceId=${a}`)
        .set(withAuth(KW_READ))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].phrase).toBe('react');
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('DELETE /api/v1/marketing/monitoring-keywords/:id', () => {
    it('soft-deletes and disappears from list', async () => {
      const sourceId = await createSource();
      const created = await request(ctx.httpServer)
        .post('/api/v1/marketing/monitoring-keywords')
        .set(withAuth(KW_MANAGE))
        .send({ sourceId, phrase: 'gone', isRegex: false });

      await request(ctx.httpServer)
        .delete(`/api/v1/marketing/monitoring-keywords/${created.body.id}`)
        .set(withAuth(KW_MANAGE))
        .expect(204);

      const list = await request(ctx.httpServer)
        .get(`/api/v1/marketing/monitoring-keywords?sourceId=${sourceId}`)
        .set(withAuth(KW_READ))
        .expect(200);
      expect(list.body.data).toHaveLength(0);
    });
  });
});
