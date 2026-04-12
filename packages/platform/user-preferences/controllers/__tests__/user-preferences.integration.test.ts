import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { UserPreferencesModule } from '../../user-preferences.module';
import { USER_PREFERENCES_PERMISSIONS } from '../../permissions';

const READ = [USER_PREFERENCES_PERMISSIONS.READ];
const WRITE = [USER_PREFERENCES_PERMISSIONS.WRITE];
const ALL = [USER_PREFERENCES_PERMISSIONS.READ, USER_PREFERENCES_PERMISSIONS.WRITE];

describe('UserPreferencesController (integration)', () => {
  let ctx: PackageTestApp;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [UserPreferencesModule],
    });

    // Ensure the table exists. The shared global-setup runs drizzle-kit
    // migrate, but the recruit migration chain has a pre-existing breakage
    // that can prevent later migrations (including 0043) from running
    // depending on the test DB state. This idempotent fallback keeps the
    // package's tests hermetic.
    await ctx.db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_preferences" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "namespace" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "value" JSONB NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await ctx.db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_ns_key_unique"
      ON "user_preferences" ("user_id", "namespace", "key")
    `);
    await ctx.db.execute(sql`
      CREATE INDEX IF NOT EXISTS "user_preferences_user_ns_idx"
      ON "user_preferences" ("user_id", "namespace")
    `);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    userAId = randomUUID();
    userBId = randomUUID();
    await ctx.db.execute(
      sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at) VALUES (${userAId}, ${`a-${Date.now()}@example.com`}, ${'User'}, ${'A'}, ${'admin'}, NOW())`,
    );
    await ctx.db.execute(
      sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at) VALUES (${userBId}, ${`b-${Date.now()}@example.com`}, ${'User'}, ${'B'}, ${'admin'}, NOW())`,
    );
  });

  // ── PUT /me/preferences/:namespace/:key ─────────────────

  describe('PUT /api/v1/me/preferences/:namespace/:key', () => {
    it('creates a new preference', async () => {
      const res = await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(ALL, { userId: userAId }))
        .send({ value: { presetId: 'ocean', mode: 'dark' } })
        .expect(200);

      expect(res.body).toMatchObject({
        userId: userAId,
        namespace: 'theming',
        key: 'theme',
        value: { presetId: 'ocean', mode: 'dark' },
      });
      expect(res.body.id).toBeDefined();
    });

    it('upserts an existing preference', async () => {
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(ALL, { userId: userAId }))
        .send({ value: { presetId: 'ocean' } })
        .expect(200);

      const res = await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(ALL, { userId: userAId }))
        .send({ value: { presetId: 'forest' } })
        .expect(200);

      expect(res.body.value).toEqual({ presetId: 'forest' });

      const list = await request(ctx.httpServer)
        .get('/api/v1/me/preferences')
        .set(withAuth(READ, { userId: userAId }))
        .expect(200);

      expect(list.body).toHaveLength(1);
    });

    it('accepts primitive values', async () => {
      const res = await request(ctx.httpServer)
        .put('/api/v1/me/preferences/ui/sidebar-collapsed')
        .set(withAuth(WRITE, { userId: userAId }))
        .send({ value: true })
        .expect(200);

      expect(res.body.value).toBe(true);
    });
  });

  // ── GET /me/preferences ─────────────────────────────────

  describe('GET /api/v1/me/preferences', () => {
    it('lists only the current user\'s preferences', async () => {
      // User A sets two prefs
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userAId }))
        .send({ value: { presetId: 'ocean' } })
        .expect(200);
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/ui/density')
        .set(withAuth(WRITE, { userId: userAId }))
        .send({ value: 'compact' })
        .expect(200);

      // User B sets one pref
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userBId }))
        .send({ value: { presetId: 'midnight' } })
        .expect(200);

      // User A lists — should only see their own
      const resA = await request(ctx.httpServer)
        .get('/api/v1/me/preferences')
        .set(withAuth(READ, { userId: userAId }))
        .expect(200);

      expect(resA.body).toHaveLength(2);
      for (const pref of resA.body) {
        expect(pref.userId).toBe(userAId);
      }

      // User B lists — should only see theirs
      const resB = await request(ctx.httpServer)
        .get('/api/v1/me/preferences')
        .set(withAuth(READ, { userId: userBId }))
        .expect(200);

      expect(resB.body).toHaveLength(1);
      expect(resB.body[0].userId).toBe(userBId);
      expect(resB.body[0].value).toEqual({ presetId: 'midnight' });
    });

    it('filters by namespace', async () => {
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userAId }))
        .send({ value: { presetId: 'ocean' } })
        .expect(200);
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/ui/density')
        .set(withAuth(WRITE, { userId: userAId }))
        .send({ value: 'compact' })
        .expect(200);

      const res = await request(ctx.httpServer)
        .get('/api/v1/me/preferences?namespace=theming')
        .set(withAuth(READ, { userId: userAId }))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].namespace).toBe('theming');
    });
  });

  // ── GET /me/preferences/:namespace/:key ─────────────────

  describe('GET /api/v1/me/preferences/:namespace/:key', () => {
    it('returns the pref', async () => {
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userAId }))
        .send({ value: { presetId: 'sunset' } })
        .expect(200);

      const res = await request(ctx.httpServer)
        .get('/api/v1/me/preferences/theming/theme')
        .set(withAuth(READ, { userId: userAId }))
        .expect(200);

      expect(res.body.value).toEqual({ presetId: 'sunset' });
    });

    it('returns 404 when not set', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/me/preferences/theming/theme')
        .set(withAuth(READ, { userId: userAId }))
        .expect(404);
    });

    it('cannot read another user\'s pref even by matching namespace/key', async () => {
      // User B writes their pref
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userBId }))
        .send({ value: { presetId: 'midnight' } })
        .expect(200);

      // User A queries the same namespace/key — should 404 (they don't have one)
      await request(ctx.httpServer)
        .get('/api/v1/me/preferences/theming/theme')
        .set(withAuth(READ, { userId: userAId }))
        .expect(404);
    });
  });

  // ── DELETE /me/preferences/:namespace/:key ──────────────

  describe('DELETE /api/v1/me/preferences/:namespace/:key', () => {
    it('deletes own pref', async () => {
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userAId }))
        .send({ value: { presetId: 'ocean' } })
        .expect(200);

      await request(ctx.httpServer)
        .delete('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userAId }))
        .expect(204);

      await request(ctx.httpServer)
        .get('/api/v1/me/preferences/theming/theme')
        .set(withAuth(READ, { userId: userAId }))
        .expect(404);
    });

    it('cannot delete another user\'s pref', async () => {
      // User B creates a pref
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userBId }))
        .send({ value: { presetId: 'midnight' } })
        .expect(200);

      // User A issues delete on the same namespace/key — should succeed as a no-op
      // (service scopes by userA's id, so no row matches)
      await request(ctx.httpServer)
        .delete('/api/v1/me/preferences/theming/theme')
        .set(withAuth(WRITE, { userId: userAId }))
        .expect(204);

      // User B's pref is untouched
      const res = await request(ctx.httpServer)
        .get('/api/v1/me/preferences/theming/theme')
        .set(withAuth(READ, { userId: userBId }))
        .expect(200);

      expect(res.body.value).toEqual({ presetId: 'midnight' });
    });
  });

  // ── Permission enforcement ──────────────────────────────

  describe('Permission enforcement', () => {
    it('returns 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/me/preferences')
        .expect(401);
    });

    it('returns 403 without read permission on list', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/me/preferences')
        .set(withAuth([], { userId: userAId }))
        .expect(403);
    });

    it('returns 403 without write permission on PUT', async () => {
      await request(ctx.httpServer)
        .put('/api/v1/me/preferences/theming/theme')
        .set(withAuth(READ, { userId: userAId }))
        .send({ value: { presetId: 'ocean' } })
        .expect(403);
    });

    it('returns 403 without write permission on DELETE', async () => {
      await request(ctx.httpServer)
        .delete('/api/v1/me/preferences/theming/theme')
        .set(withAuth(READ, { userId: userAId }))
        .expect(403);
    });

    it('allows superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/me/preferences')
        .set(withAuth(['*'], { userId: userAId }))
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });
});
