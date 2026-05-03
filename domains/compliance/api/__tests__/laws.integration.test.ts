import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';

const READ = ['laws.read'];
const MANAGE = ['laws.read', 'laws.create', 'laws.update', 'laws.delete'];
// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read endpoints whose only `@RequirePermission` is `*.read`.
const NO_PERMS: string[] = [];

describe('Laws (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createComplianceTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await resetComplianceTestDb(ctx);
  });

  let seq = 0;
  const unique = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`;

  async function createLaw(overrides: Record<string, unknown> = {}) {
    const body = {
      name: 'Test Law',
      code: unique('LAW'),
      jurisdiction: 'central',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/laws')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  describe('POST /api/v1/laws', () => {
    it('creates a law', async () => {
      const code = unique('LAW');
      const res = await request(ctx.httpServer)
        .post('/api/v1/laws')
        .set(withAuth(MANAGE))
        .send({ name: 'Companies Act 2013', code, jurisdiction: 'central' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Companies Act 2013',
        code,
        jurisdiction: 'central',
      });
    });

    it('rejects duplicate code', async () => {
      const code = unique('LAW');
      await createLaw({ code });
      await request(ctx.httpServer)
        .post('/api/v1/laws')
        .set(withAuth(MANAGE))
        .send({ name: 'Dup', code, jurisdiction: 'central' })
        .expect(409);
    });

    it('rejects missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/laws')
        .set(withAuth(MANAGE))
        .send({ code: unique('LAW'), jurisdiction: 'central' })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/laws')
        .send({ name: 'X', code: unique('LAW') })
        .expect(401);
    });

    it('returns 403 with read-only permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/laws')
        .set(withAuth(READ))
        .send({ name: 'X', code: unique('LAW') })
        .expect(403);
    });
  });

  describe('GET /api/v1/laws', () => {
    it('lists laws', async () => {
      await createLaw({ name: 'Law A', code: unique('LAWA') });
      await createLaw({ name: 'Law B', code: unique('LAWB') });

      const res = await request(ctx.httpServer)
        .get('/api/v1/laws')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/laws').expect(401);
    });

    it('returns 403 without laws.read', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/laws')
        .set(withAuth(NO_PERMS))
        .expect(403);
    });
  });

  // SKIPPED — these describe blocks exercise routes that no longer exist
  // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
  // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
  // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
  // module switched from `EntityEngineModule.forEntity` to its own
  // hand-rolled controller. The tests pre-date that migration and now hit
  // 404 instead of the expected 401/403. Skipped pending user approval to
  // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
  describe.skip('GET /api/v1/laws/layout/list', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/laws/layout/list').expect(401);
    });

    it('returns 403 without laws.read', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/laws/layout/list')
        .set(withAuth(NO_PERMS))
        .expect(403);
    });
  });

  describe('GET /api/v1/laws/tree', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/laws/tree').expect(401);
    });

    it('returns 403 without laws.read', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/laws/tree')
        .set(withAuth(NO_PERMS))
        .expect(403);
    });
  });

  describe('GET /api/v1/laws/:id', () => {
    it('returns a law by id', async () => {
      const law = await createLaw();
      const res = await request(ctx.httpServer)
        .get(`/api/v1/laws/${law.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: law.id, name: law.name });
    });

    it('returns 404 for unknown id', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/laws/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/laws/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('returns 403 without laws.read', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/laws/00000000-0000-0000-0000-000000000000')
        .set(withAuth(NO_PERMS))
        .expect(403);
    });
  });

  describe('PATCH /api/v1/laws/:id', () => {
    it('updates a law', async () => {
      const law = await createLaw();
      const res = await request(ctx.httpServer)
        .patch(`/api/v1/laws/${law.id}`)
        .set(withAuth(MANAGE))
        .send({ issuingAuthority: 'MCA' })
        .expect(200);

      expect(res.body.issuingAuthority).toBe('MCA');
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .patch('/api/v1/laws/00000000-0000-0000-0000-000000000000')
        .send({ issuingAuthority: 'MCA' })
        .expect(401);
    });

    it('returns 403 without update permission', async () => {
      const law = await createLaw();
      await request(ctx.httpServer)
        .patch(`/api/v1/laws/${law.id}`)
        .set(withAuth(READ))
        .send({ issuingAuthority: 'MCA' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/laws/:id', () => {
    it('accepts the delete request', async () => {
      const law = await createLaw();
      await request(ctx.httpServer)
        .delete(`/api/v1/laws/${law.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .delete('/api/v1/laws/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('returns 403 without delete permission', async () => {
      const law = await createLaw();
      await request(ctx.httpServer)
        .delete(`/api/v1/laws/${law.id}`)
        .set(withAuth(READ))
        .expect(403);
    });
  });

  // SKIPPED — these describe blocks exercise routes that no longer exist
  // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
  // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
  // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
  // module switched from `EntityEngineModule.forEntity` to its own
  // hand-rolled controller. The tests pre-date that migration and now hit
  // 404 instead of the expected 401/403. Skipped pending user approval to
  // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
  describe.skip('POST /api/v1/laws/:id/clone', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/laws/00000000-0000-0000-0000-000000000000/clone')
        .expect(401);
    });

    it('returns 403 without create permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/laws/00000000-0000-0000-0000-000000000000/clone')
        .set(withAuth(READ))
        .expect(403);
    });
  });

  // SKIPPED — these describe blocks exercise routes that no longer exist
  // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
  // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
  // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
  // module switched from `EntityEngineModule.forEntity` to its own
  // hand-rolled controller. The tests pre-date that migration and now hit
  // 404 instead of the expected 401/403. Skipped pending user approval to
  // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
  describe.skip('POST /api/v1/laws/:id/restore', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/laws/00000000-0000-0000-0000-000000000000/restore')
        .expect(401);
    });

    it('returns 403 without update permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/laws/00000000-0000-0000-0000-000000000000/restore')
        .set(withAuth(READ))
        .expect(403);
    });
  });

  describe('hierarchy', () => {
    it('allows parentId for hierarchical laws', async () => {
      const parent = await createLaw({ name: 'Parent Act' });
      const child = await createLaw({ name: 'Child Rule', parentId: parent.id });

      expect(child.parentId).toBe(parent.id);
    });
  });
});
