import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { PagesModule } from '../../pages.module';
import { pages } from '../../schema/pages';
import { sections } from '../../schema/sections';

const UPDATE = ['pages.update'];

describe('PagesPublicController (integration)', () => {
  let ctx: PackageTestApp;
  let testUserId: string;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [PagesModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    testUserId = randomUUID();
    await ctx.db.execute(
      sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at)
          VALUES (${testUserId}, ${`test-${Date.now()}@example.com`}, ${'Test'}, ${'User'}, ${'admin'}, NOW())`,
    );
  });

  async function insertPage(
    overrides: Partial<{
      slug: string;
      title: string;
      deletedAt: Date | null;
      status: 'draft' | 'scheduled' | 'published' | 'archived';
      publishedAt: Date | null;
    }> = {},
  ) {
    const id = randomUUID();
    await ctx.db.insert(pages).values({
      id,
      slug: overrides.slug ?? `slug-${id.slice(0, 8)}`,
      title: overrides.title ?? 'Untitled',
      createdBy: testUserId,
      // Default test pages to live so existing tests keep focusing on their
      // actual concern — lifecycle gating has dedicated tests below.
      status: overrides.status ?? 'published',
      publishedAt: overrides.publishedAt !== undefined ? overrides.publishedAt : new Date(Date.now() - 1000),
      ...(overrides.deletedAt !== undefined ? { deletedAt: overrides.deletedAt, deletedBy: testUserId } : {}),
    });
    return id;
  }

  async function insertSection(
    pageId: string,
    order: number,
    blockKind: string,
    customFields: Record<string, unknown> = {},
    variant: string | null = null,
  ) {
    const id = randomUUID();
    await ctx.db.insert(sections).values({
      id,
      pageId,
      order,
      blockKind,
      variant,
      customFields,
    });
    return id;
  }

  // ── Public by-slug ──────────────────────────────────────────

  describe('GET /api/v1/public/pages/:slug', () => {
    it('returns the page + ordered sections anonymously', async () => {
      const pageId = await insertPage({ slug: 'home', title: 'Welcome' });
      await insertSection(pageId, 1, 'cta', { text: 'Sign up' });
      await insertSection(pageId, 0, 'hero-split', { headline: 'Hello' });

      const res = await request(ctx.httpServer).get('/api/v1/public/pages/home').expect(200);

      expect(res.body.page).toMatchObject({ id: pageId, slug: 'home', title: 'Welcome' });
      expect(res.body.sections).toHaveLength(2);
      expect(res.body.sections[0]).toMatchObject({
        order: 0,
        blockKind: 'hero-split',
        title: null,
        customFields: { headline: 'Hello' },
        data: {},
      });
      expect(res.body.sections[1]).toMatchObject({
        order: 1,
        blockKind: 'cta',
        title: null,
        customFields: { text: 'Sign up' },
        data: {},
      });
    });

    it('returns section title when set (used as the block heading)', async () => {
      const pageId = await insertPage({ slug: 'about' });
      const id = randomUUID();
      await ctx.db.insert(sections).values({
        id,
        pageId,
        order: 0,
        blockKind: 'hero-split',
        title: 'About Acme',
        customFields: {},
      });

      const res = await request(ctx.httpServer).get('/api/v1/public/pages/about').expect(200);

      expect(res.body.sections[0]).toMatchObject({ title: 'About Acme', data: {} });
    });

    it('returns 404 for an unknown slug', async () => {
      await request(ctx.httpServer).get('/api/v1/public/pages/nope').expect(404);
    });

    it('returns 404 for a soft-deleted page', async () => {
      await insertPage({ slug: 'gone', deletedAt: new Date() });
      await request(ctx.httpServer).get('/api/v1/public/pages/gone').expect(404);
    });

    it('returns 404 for a draft page', async () => {
      await insertPage({ slug: 'draft-page', status: 'draft', publishedAt: null });
      await request(ctx.httpServer).get('/api/v1/public/pages/draft-page').expect(404);
    });

    it('returns 404 for an archived page', async () => {
      await insertPage({ slug: 'archived', status: 'archived', publishedAt: new Date(Date.now() - 1000) });
      await request(ctx.httpServer).get('/api/v1/public/pages/archived').expect(404);
    });

    it('returns 404 when publishedAt is in the future (scheduled)', async () => {
      await insertPage({
        slug: 'future',
        status: 'published',
        publishedAt: new Date(Date.now() + 60_000),
      });
      await request(ctx.httpServer).get('/api/v1/public/pages/future').expect(404);
    });

    it('returns 200 once the scheduled time has passed', async () => {
      await insertPage({
        slug: 'just-live',
        status: 'published',
        publishedAt: new Date(Date.now() - 5_000),
      });
      await request(ctx.httpServer).get('/api/v1/public/pages/just-live').expect(200);
    });
  });

  // ── Public index ────────────────────────────────────────────

  describe('GET /api/v1/public/pages', () => {
    it('returns only published, non-deleted, non-future pages sorted by slug', async () => {
      await insertPage({ slug: 'about', status: 'published' });
      await insertPage({ slug: 'work', status: 'published' });
      await insertPage({ slug: 'internal-draft', status: 'draft', publishedAt: null });
      await insertPage({ slug: 'archived', status: 'archived' });
      await insertPage({
        slug: 'future',
        status: 'published',
        publishedAt: new Date(Date.now() + 60_000),
      });
      await insertPage({ slug: 'gone', deletedAt: new Date() });

      const res = await request(ctx.httpServer).get('/api/v1/public/pages').expect(200);

      const slugs = res.body.pages.map((p: { slug: string }) => p.slug);
      expect(slugs).toEqual(['about', 'work']);
      expect(res.body.pages[0]).toMatchObject({
        slug: 'about',
        updatedAt: expect.any(String),
        publishedAt: expect.any(String),
      });
    });
  });

  // ── Reorder (auth + permission) ─────────────────────────────

  describe('PUT /api/v1/pages/:pageId/sections:reorder', () => {
    it('returns 401 without auth', async () => {
      const pageId = await insertPage();
      await request(ctx.httpServer)
        .put(`/api/v1/pages/${pageId}/sections:reorder`)
        .send({ orders: [{ id: randomUUID(), order: 0 }] })
        .expect(401);
    });

    it('returns 403 without the pages.update permission', async () => {
      const pageId = await insertPage();
      const s1 = await insertSection(pageId, 0, 'text');
      await request(ctx.httpServer)
        .put(`/api/v1/pages/${pageId}/sections:reorder`)
        .set(withAuth([], { userId: testUserId }))
        .send({ orders: [{ id: s1, order: 1 }] })
        .expect(403);
    });

    it('reorders successfully with pages.update', async () => {
      const pageId = await insertPage();
      const s1 = await insertSection(pageId, 0, 'hero-split');
      const s2 = await insertSection(pageId, 1, 'cta');

      await request(ctx.httpServer)
        .put(`/api/v1/pages/${pageId}/sections:reorder`)
        .set(withAuth(UPDATE, { userId: testUserId }))
        .send({ orders: [{ id: s1, order: 1 }, { id: s2, order: 0 }] })
        .expect(204);

      const rows = await ctx.db.select({ id: sections.id, order: sections.order }).from(sections);
      const byId = new Map(rows.map((r) => [r.id, r.order]));
      expect(byId.get(s1)).toBe(1);
      expect(byId.get(s2)).toBe(0);
    });

    it('rejects sections belonging to a different page', async () => {
      const pageA = await insertPage({ slug: 'a' });
      const pageB = await insertPage({ slug: 'b' });
      const sA = await insertSection(pageA, 0, 'hero-split');
      const sB = await insertSection(pageB, 0, 'cta');

      await request(ctx.httpServer)
        .put(`/api/v1/pages/${pageA}/sections:reorder`)
        .set(withAuth(UPDATE, { userId: testUserId }))
        .send({ orders: [{ id: sA, order: 1 }, { id: sB, order: 0 }] })
        .expect(400);
    });
  });
});
