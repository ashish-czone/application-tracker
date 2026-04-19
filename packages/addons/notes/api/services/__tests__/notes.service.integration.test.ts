import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { sql } from '@packages/database';
import { users } from '@packages/database/schema';
import { AuditModule } from '@packages/audit';
import { NotesModule } from '../../notes.module';
import { NotesService } from '../notes.service';
import { notes } from '../../schema/notes';
import { noteMentions } from '../../schema/note-mentions';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('NotesService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let notesService: NotesService;

  // Test user IDs
  let authorId: string;
  let otherUserId: string;
  let mentionUser1Id: string;
  let mentionUser2Id: string;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      imports: [AuditModule, NotesModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    notesService = module.get(NotesService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  /** Insert a test user and return its ID. */
  async function createUser(overrides: Partial<{ email: string; firstName: string; lastName: string }> = {}): Promise<string> {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: overrides.email ?? `user-${id.slice(0, 8)}@test.com`,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
      userType: 'internal',
    });
    return id;
  }

  /** Seed common test users used across tests. */
  async function seedUsers() {
    authorId = await createUser({ firstName: 'Author', lastName: 'One', email: 'author@test.com' });
    otherUserId = await createUser({ firstName: 'Other', lastName: 'User', email: 'other@test.com' });
    mentionUser1Id = await createUser({ firstName: 'Mention', lastName: 'One', email: 'mention1@test.com' });
    mentionUser2Id = await createUser({ firstName: 'Mention', lastName: 'Two', email: 'mention2@test.com' });
  }

  /** Build HTML content with TipTap mention spans. */
  function contentWithMentions(...userIds: string[]): string {
    const mentions = userIds
      .map((id) => `<span data-type="mention" data-id="${id}">@user</span>`)
      .join(' ');
    return `<p>Hello ${mentions}</p>`;
  }

  // ---------- create ----------

  describe('create', () => {
    it('should create a note and return it with author info', async () => {
      await seedUsers();
      const entityId = randomUUID();

      const result = await notesService.create({
        entityType: 'candidates',
        entityId,
        content: '<p>Test note</p>',
        authorId,
      });

      expect(result.id).toBeDefined();
      expect(result.entityType).toBe('candidates');
      expect(result.entityId).toBe(entityId);
      expect(result.content).toBe('<p>Test note</p>');
      expect(result.isInternal).toBe(true);
      expect(result.authorId).toBe(authorId);
      expect(result.author).toEqual({
        id: authorId,
        firstName: 'Author',
        lastName: 'One',
        email: 'author@test.com',
      });
    });

    it('should create with isInternal=false', async () => {
      await seedUsers();

      const result = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>External note</p>',
        isInternal: false,
        authorId,
      });

      expect(result.isInternal).toBe(false);
    });

    it('should extract and sync mentions from content', async () => {
      await seedUsers();
      const entityId = randomUUID();
      const content = contentWithMentions(mentionUser1Id, mentionUser2Id);

      const result = await notesService.create({
        entityType: 'candidates',
        entityId,
        content,
        authorId,
      });

      const mentionIds = await notesService.getMentionUserIds(result.id);
      expect(mentionIds).toHaveLength(2);
      expect(mentionIds).toContain(mentionUser1Id);
      expect(mentionIds).toContain(mentionUser2Id);
    });

    it('should create note with no mentions when content has none', async () => {
      await seedUsers();

      const result = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>No mentions here</p>',
        authorId,
      });

      const mentionIds = await notesService.getMentionUserIds(result.id);
      expect(mentionIds).toHaveLength(0);
    });
  });

  // ---------- findById / findByIdOrFail ----------

  describe('findById', () => {
    it('should return note with author info', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'orders',
        entityId: randomUUID(),
        content: '<p>Find me</p>',
        authorId,
      });

      const found = await notesService.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.author.firstName).toBe('Author');
    });

    it('should return null for non-existent note', async () => {
      const found = await notesService.findById(randomUUID());
      expect(found).toBeNull();
    });

    it('should return null for soft-deleted note', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'orders',
        entityId: randomUUID(),
        content: '<p>Deleted note</p>',
        authorId,
      });

      await notesService.softDelete(created.id, authorId);

      const found = await notesService.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should throw NotFoundException for missing note', async () => {
      await expect(notesService.findByIdOrFail(randomUUID()))
        .rejects.toThrow('Note not found');
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('should update note content', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>Original</p>',
        authorId,
      });

      const updated = await notesService.update(
        created.id,
        { content: '<p>Updated</p>' },
        authorId,
      );

      expect(updated.content).toBe('<p>Updated</p>');
    });

    it('should update isInternal flag', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>Note</p>',
        isInternal: true,
        authorId,
      });

      const updated = await notesService.update(
        created.id,
        { isInternal: false },
        authorId,
      );

      expect(updated.isInternal).toBe(false);
    });

    it('should sync mentions when content changes', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: contentWithMentions(mentionUser1Id),
        authorId,
      });

      // Update content to mention a different user
      await notesService.update(
        created.id,
        { content: contentWithMentions(mentionUser2Id) },
        authorId,
      );

      const mentionIds = await notesService.getMentionUserIds(created.id);
      expect(mentionIds).toHaveLength(1);
      expect(mentionIds).toContain(mentionUser2Id);
      expect(mentionIds).not.toContain(mentionUser1Id);
    });

    it('should throw ForbiddenException when non-author tries to update', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>Note</p>',
        authorId,
      });

      await expect(
        notesService.update(created.id, { content: '<p>Hacked</p>' }, otherUserId),
      ).rejects.toThrow('Only the author can edit this note');
    });

    it('should return existing note unchanged when no fields provided', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>Unchanged</p>',
        authorId,
      });

      const updated = await notesService.update(created.id, {}, authorId);
      expect(updated.content).toBe('<p>Unchanged</p>');
    });
  });

  // ---------- softDelete ----------

  describe('softDelete', () => {
    it('should soft-delete a note', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>Delete me</p>',
        authorId,
      });

      await notesService.softDelete(created.id, authorId);

      // Verify via direct DB query (bypasses soft-delete filter)
      const [row] = await db
        .select({ deletedAt: notes.deletedAt, deletedBy: notes.deletedBy })
        .from(notes)
        .where(sql`${notes.id} = ${created.id}`);

      expect(row.deletedAt).not.toBeNull();
      expect(row.deletedBy).toBe(authorId);
    });

    it('should throw ForbiddenException when non-author tries to delete', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>Note</p>',
        authorId,
      });

      await expect(
        notesService.softDelete(created.id, otherUserId),
      ).rejects.toThrow('Only the author can delete this note');
    });

    it('should throw NotFoundException for already soft-deleted note', async () => {
      await seedUsers();
      const created = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>Note</p>',
        authorId,
      });

      await notesService.softDelete(created.id, authorId);

      // Second delete should fail (note is now invisible to findByIdOrFail)
      await expect(
        notesService.softDelete(created.id, authorId),
      ).rejects.toThrow('Note not found');
    });
  });

  // ---------- listForEntity ----------

  describe('listForEntity', () => {
    it('should return paginated notes for an entity', async () => {
      await seedUsers();
      const entityId = randomUUID();

      // Create 3 notes
      for (let i = 0; i < 3; i++) {
        await notesService.create({
          entityType: 'candidates',
          entityId,
          content: `<p>Note ${i}</p>`,
          authorId,
        });
      }

      const result = await notesService.listForEntity('candidates', entityId, 1, 10);

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should exclude soft-deleted notes', async () => {
      await seedUsers();
      const entityId = randomUUID();

      const note1 = await notesService.create({
        entityType: 'candidates',
        entityId,
        content: '<p>Active</p>',
        authorId,
      });
      const note2 = await notesService.create({
        entityType: 'candidates',
        entityId,
        content: '<p>Deleted</p>',
        authorId,
      });

      await notesService.softDelete(note2.id, authorId);

      const result = await notesService.listForEntity('candidates', entityId);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(note1.id);
    });

    it('should order by createdAt descending (newest first)', async () => {
      await seedUsers();
      const entityId = randomUUID();

      const note1 = await notesService.create({
        entityType: 'candidates',
        entityId,
        content: '<p>First</p>',
        authorId,
      });
      const note2 = await notesService.create({
        entityType: 'candidates',
        entityId,
        content: '<p>Second</p>',
        authorId,
      });

      const result = await notesService.listForEntity('candidates', entityId);
      expect(result.data[0].id).toBe(note2.id);
      expect(result.data[1].id).toBe(note1.id);
    });

    it('should paginate correctly', async () => {
      await seedUsers();
      const entityId = randomUUID();

      for (let i = 0; i < 5; i++) {
        await notesService.create({
          entityType: 'candidates',
          entityId,
          content: `<p>Note ${i}</p>`,
          authorId,
        });
      }

      const page1 = await notesService.listForEntity('candidates', entityId, 1, 2);
      expect(page1.data).toHaveLength(2);
      expect(page1.meta.total).toBe(5);
      expect(page1.meta.totalPages).toBe(3);

      const page2 = await notesService.listForEntity('candidates', entityId, 2, 2);
      expect(page2.data).toHaveLength(2);

      const page3 = await notesService.listForEntity('candidates', entityId, 3, 2);
      expect(page3.data).toHaveLength(1);
    });

    it('should not return notes from other entities', async () => {
      await seedUsers();
      const entityId1 = randomUUID();
      const entityId2 = randomUUID();

      await notesService.create({ entityType: 'candidates', entityId: entityId1, content: '<p>E1</p>', authorId });
      await notesService.create({ entityType: 'candidates', entityId: entityId2, content: '<p>E2</p>', authorId });

      const result = await notesService.listForEntity('candidates', entityId1);
      expect(result.data).toHaveLength(1);
    });
  });

  // ---------- listMentionsForUser ----------

  describe('listMentionsForUser', () => {
    it('should return notes that mention the user', async () => {
      await seedUsers();
      const entityId = randomUUID();

      // Note mentioning user1
      await notesService.create({
        entityType: 'candidates',
        entityId,
        content: contentWithMentions(mentionUser1Id),
        authorId,
      });

      // Note mentioning user2
      await notesService.create({
        entityType: 'candidates',
        entityId,
        content: contentWithMentions(mentionUser2Id),
        authorId,
      });

      const result = await notesService.listMentionsForUser(mentionUser1Id);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should exclude soft-deleted notes from mentions', async () => {
      await seedUsers();
      const entityId = randomUUID();

      const note = await notesService.create({
        entityType: 'candidates',
        entityId,
        content: contentWithMentions(mentionUser1Id),
        authorId,
      });

      await notesService.softDelete(note.id, authorId);

      const result = await notesService.listMentionsForUser(mentionUser1Id);
      expect(result.data).toHaveLength(0);
    });

    it('should return empty when user has no mentions', async () => {
      await seedUsers();

      const result = await notesService.listMentionsForUser(mentionUser1Id);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ---------- getMentionUserIds ----------

  describe('getMentionUserIds', () => {
    it('should return user IDs of mentions for a note', async () => {
      await seedUsers();
      const content = contentWithMentions(mentionUser1Id, mentionUser2Id);

      const note = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content,
        authorId,
      });

      const ids = await notesService.getMentionUserIds(note.id);
      expect(ids).toHaveLength(2);
      expect(ids).toContain(mentionUser1Id);
      expect(ids).toContain(mentionUser2Id);
    });

    it('should return empty array for note with no mentions', async () => {
      await seedUsers();

      const note = await notesService.create({
        entityType: 'candidates',
        entityId: randomUUID(),
        content: '<p>No mentions</p>',
        authorId,
      });

      const ids = await notesService.getMentionUserIds(note.id);
      expect(ids).toHaveLength(0);
    });
  });

  // ---------- softDeleteAllForEntity ----------

  describe('softDeleteAllForEntity', () => {
    it('should soft-delete all notes for an entity', async () => {
      await seedUsers();
      const entityId = randomUUID();

      await notesService.create({ entityType: 'candidates', entityId, content: '<p>N1</p>', authorId });
      await notesService.create({ entityType: 'candidates', entityId, content: '<p>N2</p>', authorId });
      await notesService.create({ entityType: 'candidates', entityId, content: '<p>N3</p>', authorId });

      await notesService.softDeleteAllForEntity('candidates', entityId, authorId);

      const result = await notesService.listForEntity('candidates', entityId);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should not affect notes of other entities', async () => {
      await seedUsers();
      const entityId1 = randomUUID();
      const entityId2 = randomUUID();

      await notesService.create({ entityType: 'candidates', entityId: entityId1, content: '<p>E1</p>', authorId });
      await notesService.create({ entityType: 'candidates', entityId: entityId2, content: '<p>E2</p>', authorId });

      await notesService.softDeleteAllForEntity('candidates', entityId1, authorId);

      const result = await notesService.listForEntity('candidates', entityId2);
      expect(result.data).toHaveLength(1);
    });

    it('should skip already soft-deleted notes', async () => {
      await seedUsers();
      const entityId = randomUUID();

      const note1 = await notesService.create({ entityType: 'candidates', entityId, content: '<p>N1</p>', authorId });
      await notesService.create({ entityType: 'candidates', entityId, content: '<p>N2</p>', authorId });

      // Soft-delete one note first
      await notesService.softDelete(note1.id, authorId);

      // Now soft-delete all — should only affect the remaining active note
      await notesService.softDeleteAllForEntity('candidates', entityId, otherUserId);

      // Verify all are now soft-deleted (2 total)
      const rows = await db
        .select({ id: notes.id, deletedBy: notes.deletedBy })
        .from(notes)
        .where(sql`${notes.entityType} = 'candidates' AND ${notes.entityId} = ${entityId}`);

      expect(rows).toHaveLength(2);
      // First was deleted by author, second by otherUser
      const deletedByAuthor = rows.find((r) => r.deletedBy === authorId);
      const deletedByOther = rows.find((r) => r.deletedBy === otherUserId);
      expect(deletedByAuthor).toBeDefined();
      expect(deletedByOther).toBeDefined();
    });
  });
});
