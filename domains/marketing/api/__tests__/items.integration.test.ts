import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type TestAppContext } from '@packages/platform-testing';
import { sql } from 'drizzle-orm';
import { createMarketingTestApp, resetMarketingTestDb } from './setup/app';
import { MonitoringItemsService } from '../monitoring/items/items.service';

const SOURCES_MANAGE = [
  'marketing.monitoring-sources.read',
  'marketing.monitoring-sources.manage',
];
const KW_MANAGE = [
  'marketing.monitoring-keywords.read',
  'marketing.monitoring-keywords.manage',
];
const ITEMS_READ = ['marketing.monitoring-items.read'];
const ITEMS_TRIAGE = [
  'marketing.monitoring-items.read',
  'marketing.monitoring-items.triage',
];

describe('MonitoringItems (integration)', () => {
  let ctx: TestAppContext;
  let itemsService: MonitoringItemsService;

  beforeAll(async () => {
    ctx = await createMarketingTestApp();
    itemsService = ctx.module.get(MonitoringItemsService);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await resetMarketingTestDb(ctx);
  });

  async function setupSourceWithKeyword(): Promise<string> {
    const source = await request(ctx.httpServer)
      .post('/api/v1/marketing/monitoring-sources')
      .set(withAuth(SOURCES_MANAGE))
      .send({ kind: 'reddit', label: 'r/x', config: { subreddit: 'x' } });
    await request(ctx.httpServer)
      .post('/api/v1/marketing/monitoring-keywords')
      .set(withAuth(KW_MANAGE))
      .send({ sourceId: source.body.id, phrase: 'developer', isRegex: false });
    return source.body.id;
  }

  describe('GET /api/v1/marketing/monitoring-items', () => {
    it('returns ingested items in the inbox', async () => {
      const sourceId = await setupSourceWithKeyword();

      // Ingest via service so we don't have to hit Reddit
      await itemsService.ingestItem(sourceId, {
        externalId: 't3_abc',
        url: 'https://reddit.com/r/x/abc',
        title: 'Need a developer',
        bodyExcerpt: 'looking for help',
        author: 'someone',
      });

      const res = await request(ctx.httpServer)
        .get('/api/v1/marketing/monitoring-items')
        .set(withAuth(ITEMS_READ))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        sourceId,
        externalId: 't3_abc',
        title: 'Need a developer',
        status: 'new',
      });
    });

    it('drops items that do not match any active keyword', async () => {
      const sourceId = await setupSourceWithKeyword();

      const result = await itemsService.ingestItem(sourceId, {
        externalId: 't3_xyz',
        url: 'https://reddit.com/r/x/xyz',
        title: 'irrelevant topic',
        bodyExcerpt: 'nothing about software',
      });

      expect(result).toBeNull();

      const res = await request(ctx.httpServer)
        .get('/api/v1/marketing/monitoring-items')
        .set(withAuth(ITEMS_READ))
        .expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/marketing/monitoring-items').expect(401);
    });
  });

  describe('POST /api/v1/marketing/monitoring-items/:id/engage', () => {
    it('transitions new → engaged', async () => {
      const sourceId = await setupSourceWithKeyword();
      const ingested = await itemsService.ingestItem(sourceId, {
        externalId: 't3_a',
        url: 'https://reddit.com/r/x/a',
        title: 'Need a developer',
      });

      const res = await request(ctx.httpServer)
        .post(`/api/v1/marketing/monitoring-items/${ingested!.id}/engage`)
        .set(withAuth(ITEMS_TRIAGE))
        .send({ note: 'replied on the thread' })
        .expect(200);

      expect(res.body.status).toBe('engaged');
      expect(res.body.engagementNote).toBe('replied on the thread');
    });

    it('returns 403 with read-only perms', async () => {
      const sourceId = await setupSourceWithKeyword();
      const ingested = await itemsService.ingestItem(sourceId, {
        externalId: 't3_b',
        url: 'https://reddit.com/r/x/b',
        title: 'Need a developer',
      });

      await request(ctx.httpServer)
        .post(`/api/v1/marketing/monitoring-items/${ingested!.id}/engage`)
        .set(withAuth(ITEMS_READ))
        .send({})
        .expect(403);
    });

    it('returns 401 without auth', async () => {
      const sourceId = await setupSourceWithKeyword();
      const ingested = await itemsService.ingestItem(sourceId, {
        externalId: 't3_c',
        url: 'https://reddit.com/r/x/c',
        title: 'Need a developer',
      });

      await request(ctx.httpServer)
        .post(`/api/v1/marketing/monitoring-items/${ingested!.id}/engage`)
        .send({})
        .expect(401);
    });
  });

  describe('POST /api/v1/marketing/monitoring-items/:id/dismiss', () => {
    it('transitions to dismissed', async () => {
      const sourceId = await setupSourceWithKeyword();
      const ingested = await itemsService.ingestItem(sourceId, {
        externalId: 't3_d',
        url: 'https://reddit.com/r/x/d',
        title: 'Need a developer',
      });

      const res = await request(ctx.httpServer)
        .post(`/api/v1/marketing/monitoring-items/${ingested!.id}/dismiss`)
        .set(withAuth(ITEMS_TRIAGE))
        .send({ note: 'spam' })
        .expect(200);

      expect(res.body.status).toBe('dismissed');
    });
  });

  describe('POST /api/v1/marketing/monitoring-items/:id/snooze', () => {
    it('transitions to snoozed with snoozedUntil', async () => {
      const sourceId = await setupSourceWithKeyword();
      const ingested = await itemsService.ingestItem(sourceId, {
        externalId: 't3_e',
        url: 'https://reddit.com/r/x/e',
        title: 'Need a developer',
      });

      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const res = await request(ctx.httpServer)
        .post(`/api/v1/marketing/monitoring-items/${ingested!.id}/snooze`)
        .set(withAuth(ITEMS_TRIAGE))
        .send({ snoozedUntil: future })
        .expect(200);

      expect(res.body.status).toBe('snoozed');
      expect(res.body.snoozedUntil).toBeTruthy();
    });

    it('rejects snoozedUntil in the past', async () => {
      const sourceId = await setupSourceWithKeyword();
      const ingested = await itemsService.ingestItem(sourceId, {
        externalId: 't3_f',
        url: 'https://reddit.com/r/x/f',
        title: 'Need a developer',
      });

      await request(ctx.httpServer)
        .post(`/api/v1/marketing/monitoring-items/${ingested!.id}/snooze`)
        .set(withAuth(ITEMS_TRIAGE))
        .send({ snoozedUntil: new Date(Date.now() - 60_000).toISOString() })
        .expect(400);
    });
  });
});
