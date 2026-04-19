import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { AuditModule } from '@packages/audit';
import { NotesModule } from '../../notes.module';
import { NOTES_PERMISSIONS } from '../../permissions';

const READ = [NOTES_PERMISSIONS.READ];
const CREATE = [NOTES_PERMISSIONS.CREATE];
const UPDATE = [NOTES_PERMISSIONS.UPDATE];
const DELETE = [NOTES_PERMISSIONS.DELETE];
const ALL = [NOTES_PERMISSIONS.READ, NOTES_PERMISSIONS.CREATE, NOTES_PERMISSIONS.UPDATE, NOTES_PERMISSIONS.DELETE];

describe('NotesController (integration)', () => {
  let ctx: PackageTestApp;
  let testUserId: string;
  const testEntityType = 'candidates';
  const testEntityId = randomUUID();

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [AuditModule, NotesModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    // Create a test user that notes can reference as authorId
    testUserId = randomUUID();
    await ctx.db.execute(
      sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at) VALUES (${testUserId}, ${`test-${Date.now()}@example.com`}, ${'Test'}, ${'User'}, ${'admin'}, NOW())`,
    );
  });

  // ── Helpers ──────────────────────────────────────────────────

  async function createNote(overrides: Record<string, unknown> = {}) {
    const body = {
      entityType: testEntityType,
      entityId: testEntityId,
      content: 'This is a test note.',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/notes')
      .set(withAuth([...CREATE, ...READ], { userId: testUserId }))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ────────────────────────────────────────────────────

  describe('POST /api/v1/notes', () => {
    it('should create a note', async () => {
      const note = await createNote({ content: 'Meeting notes for candidate review' });

      expect(note).toMatchObject({
        id: expect.any(String),
        entityType: testEntityType,
        entityId: testEntityId,
        content: 'Meeting notes for candidate review',
        authorId: testUserId,
      });
    });

    it('should create an internal note by default', async () => {
      const note = await createNote();

      expect(note.isInternal).toBe(true);
    });

    it('should create a non-internal note', async () => {
      const note = await createNote({ isInternal: false });

      expect(note.isInternal).toBe(false);
    });

    it('should reject missing entityType', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notes')
        .set(withAuth(CREATE, { userId: testUserId }))
        .send({ entityId: testEntityId, content: 'Hello' })
        .expect(400);
    });

    it('should reject missing entityId', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notes')
        .set(withAuth(CREATE, { userId: testUserId }))
        .send({ entityType: testEntityType, content: 'Hello' })
        .expect(400);
    });

    it('should reject missing content', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notes')
        .set(withAuth(CREATE, { userId: testUserId }))
        .send({ entityType: testEntityType, entityId: testEntityId })
        .expect(400);
    });

    it('should reject invalid entityId (not UUID)', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notes')
        .set(withAuth(CREATE, { userId: testUserId }))
        .send({ entityType: testEntityType, entityId: 'not-a-uuid', content: 'Hello' })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notes')
        .set(withAuth(CREATE, { userId: testUserId }))
        .send({
          entityType: testEntityType,
          entityId: testEntityId,
          content: 'Hello',
          hackField: 'injected',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/notes', () => {
    it('should list notes for an entity', async () => {
      await createNote({ content: 'Note one' });
      await createNote({ content: 'Note two' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/notes?entityType=${testEntityType}&entityId=${testEntityId}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        page: 1,
        total: 2,
      });
    });

    it('should return empty for entity with no notes', async () => {
      const res = await request(ctx.httpServer)
        .get(`/api/v1/notes?entityType=${testEntityType}&entityId=${randomUUID()}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should paginate notes', async () => {
      await createNote({ content: 'Note A' });
      await createNote({ content: 'Note B' });
      await createNote({ content: 'Note C' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/notes?entityType=${testEntityType}&entityId=${testEntityId}&page=1&limit=2`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(3);
    });

    it('should reject missing entityType', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/notes?entityId=${testEntityId}`)
        .set(withAuth(READ))
        .expect(400);
    });

    it('should reject missing entityId', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/notes?entityType=${testEntityType}`)
        .set(withAuth(READ))
        .expect(400);
    });
  });

  describe('GET /api/v1/notes/:id', () => {
    it('should return a note by ID', async () => {
      const note = await createNote({ content: 'Specific note' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/notes/${note.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({
        id: note.id,
        content: 'Specific note',
      });
    });

    it('should return 404 for non-existent note', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/notes/${randomUUID()}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/notes/:id', () => {
    it('should update note content by the author', async () => {
      const note = await createNote();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/notes/${note.id}`)
        .set(withAuth(UPDATE, { userId: testUserId }))
        .send({ content: 'Updated content' })
        .expect(200);

      expect(res.body.content).toBe('Updated content');
    });

    it('should update isInternal flag', async () => {
      const note = await createNote({ isInternal: true });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/notes/${note.id}`)
        .set(withAuth(UPDATE, { userId: testUserId }))
        .send({ isInternal: false })
        .expect(200);

      expect(res.body.isInternal).toBe(false);
    });

    it('should reject update by non-author', async () => {
      const note = await createNote();

      await request(ctx.httpServer)
        .patch(`/api/v1/notes/${note.id}`)
        .set(withAuth(UPDATE, { userId: randomUUID() }))
        .send({ content: 'Hijack!' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/notes/:id', () => {
    it('should soft delete a note by the author', async () => {
      const note = await createNote();

      await request(ctx.httpServer)
        .delete(`/api/v1/notes/${note.id}`)
        .set(withAuth(DELETE, { userId: testUserId }))
        .expect(204);

      // Soft-deleted notes should not be found
      await request(ctx.httpServer)
        .get(`/api/v1/notes/${note.id}`)
        .set(withAuth(READ))
        .expect(404);
    });

    it('should reject deletion by non-author', async () => {
      const note = await createNote();

      await request(ctx.httpServer)
        .delete(`/api/v1/notes/${note.id}`)
        .set(withAuth(DELETE, { userId: randomUUID() }))
        .expect(403);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/notes?entityType=${testEntityType}&entityId=${testEntityId}`)
        .expect(401);
    });

    it('should return 403 with read-only on create endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notes')
        .set(withAuth(READ, { userId: testUserId }))
        .send({ entityType: testEntityType, entityId: testEntityId, content: 'Hello' })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get(`/api/v1/notes?entityType=${testEntityType}&entityId=${testEntityId}`)
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
