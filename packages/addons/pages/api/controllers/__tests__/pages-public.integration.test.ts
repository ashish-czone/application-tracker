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

  async function insertPage(overrides: Partial<{ slug: string; title: string; deletedAt: Date | null }> = {}) {
    const id = randomUUID();
    await ctx.db.insert(pages).values({
      id,
      slug: overrides.slug ?? `slug-${id.slice(0, 8)}`,
      title: overrides.title ?? 'Untitled',
      createdBy: testUserId,
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
      expect(res.body.sections[0]).toMatchObject({ order: 0, blockKind: 'hero-split', customFields: { headline: 'Hello' } });
      expect(res.body.sections[1]).toMatchObject({ order: 1, blockKind: 'cta', customFields: { text: 'Sign up' } });
    });

    it('returns 404 for an unknown slug', async () => {
      await request(ctx.httpServer).get('/api/v1/public/pages/nope').expect(404);
    });

    it('returns 404 for a soft-deleted page', async () => {
      await insertPage({ slug: 'gone', deletedAt: new Date() });
      await request(ctx.httpServer).get('/api/v1/public/pages/gone').expect(404);
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
