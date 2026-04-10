import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotesService } from '../notes.service';
import {
  NOTES_NOTE_CREATED,
  NOTES_NOTE_UPDATED,
  NOTES_NOTE_DELETED,
} from '../../events/types';

// --- Mocks ---

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

vi.mock('../../helpers/extract-mentions', () => ({
  extractMentionUserIds: vi.fn().mockReturnValue([]),
}));

import { extractMentionUserIds } from '../../helpers/extract-mentions';

// --- Mock helpers ---

/**
 * Creates a mock Drizzle DB where every chain method returns the chain itself,
 * and the chain is thenable. Each `await` on the chain pops the next value
 * from a FIFO queue (pushed via `_enqueue`). If empty, resolves to `undefined`.
 *
 * This handles the fact that Drizzle chains have different terminal methods
 * depending on the query type:
 *   - select...where().limit()  → limit is "terminal" (result of await)
 *   - update...set().where()    → where is "terminal"
 *   - insert...values().returning() → returning is "terminal"
 * By making the whole chain thenable with a queue, we don't need to worry
 * about which method is terminal — we just enqueue the results in order.
 */
function createMockDb() {
  const resolveQueue: unknown[] = [];

  const mockChain: Record<string, any> = {
    _enqueue: (...values: unknown[]) => { resolveQueue.push(...values); },
  };

  const methods = [
    'select', 'from', 'innerJoin', 'where', 'limit', 'offset',
    'orderBy', 'insert', 'values', 'returning', 'update', 'set', 'delete',
  ];

  for (const method of methods) {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  }

  // Thenable: each await consumes one queued value
  mockChain.then = (
    resolve: (v: unknown) => void,
    _reject?: (e: unknown) => void,
  ) => {
    const value = resolveQueue.length > 0 ? resolveQueue.shift() : undefined;
    resolve(value);
  };

  return { db: mockChain, _chain: mockChain };
}

function createMockEventEmitter() {
  return { emit: vi.fn() };
}

function createService() {
  const { db, _chain } = createMockDb();
  const eventEmitter = createMockEventEmitter();

  const service = new NotesService(
    { db } as any,
    eventEmitter as any,
  );

  return { service, db, _chain, eventEmitter };
}

// --- Fixtures ---

const now = new Date('2026-01-15T10:00:00.000Z');

function makeNoteRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'note-1',
    entityType: 'candidates',
    entityId: 'cand-1',
    content: '<p>Hello world</p>',
    isInternal: true,
    authorId: 'user-1',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    authorFirstName: 'Alice',
    authorLastName: 'Smith',
    authorEmail: 'alice@example.com',
    ...overrides,
  };
}

function makeNoteWithAuthor(overrides?: Partial<Record<string, unknown>>) {
  const row = makeNoteRow(overrides);
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    content: row.content,
    isInternal: row.isInternal,
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    deletedBy: row.deletedBy,
    author: {
      id: row.authorId,
      firstName: row.authorFirstName,
      lastName: row.authorLastName,
      email: row.authorEmail,
    },
  };
}

// --- Tests ---

describe('NotesService', () => {
  let service: NotesService;
  let _chain: ReturnType<typeof createMockDb>['_chain'];
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ service, _chain, eventEmitter } = createService());
  });

  // ──────────────────────────────────────────────────────────
  // findById()
  // ──────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return NoteWithAuthor when note exists', async () => {
      // select().from().innerJoin().where().limit(1) → await resolves
      _chain._enqueue([makeNoteRow()]);

      const result = await service.findById('note-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('note-1');
      expect(result!.content).toBe('<p>Hello world</p>');
      expect(result!.author).toEqual({
        id: 'user-1',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
      });
    });

    it('should return null when note does not exist', async () => {
      _chain._enqueue([]);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should call select, from, innerJoin, where, and limit', async () => {
      _chain._enqueue([]);

      await service.findById('note-1');

      expect(_chain.select).toHaveBeenCalled();
      expect(_chain.from).toHaveBeenCalled();
      expect(_chain.innerJoin).toHaveBeenCalled();
      expect(_chain.where).toHaveBeenCalled();
      expect(_chain.limit).toHaveBeenCalledWith(1);
    });
  });

  // ──────────────────────────────────────────────────────────
  // findByIdOrFail()
  // ──────────────────────────────────────────────────────────

  describe('findByIdOrFail', () => {
    it('should return NoteWithAuthor when note exists', async () => {
      _chain._enqueue([makeNoteRow()]);

      const result = await service.findByIdOrFail('note-1');

      expect(result.id).toBe('note-1');
      expect(result.author.firstName).toBe('Alice');
    });

    it('should throw NotFoundException when note does not exist', async () => {
      _chain._enqueue([]);

      await expect(service.findByIdOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw with descriptive message', async () => {
      _chain._enqueue([]);

      await expect(service.findByIdOrFail('nonexistent'))
        .rejects.toThrow('Note not found');
    });
  });

  // ──────────────────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────────────────

  describe('create', () => {
    const createInput = {
      entityType: 'candidates',
      entityId: 'cand-1',
      content: '<p>New note</p>',
      authorId: 'user-1',
    };

    function enqueueCreateFlow(noteId = 'note-new', overrides?: Partial<Record<string, unknown>>) {
      _chain._enqueue(
        // 1. insert().values().returning()
        [{ id: noteId, entityType: 'candidates', entityId: 'cand-1', content: '<p>New note</p>', isInternal: true, createdAt: now, updatedAt: now, deletedAt: null, deletedBy: null, ...overrides }],
        // 2. syncMentions: delete().where()
        undefined,
        // 3. findByIdOrFail: select...limit(1)
        [makeNoteRow({ id: noteId, content: '<p>New note</p>', ...overrides })],
      );
    }

    it('should insert note and return NoteWithAuthor', async () => {
      enqueueCreateFlow();

      const result = await service.create(createInput);

      expect(result.id).toBe('note-new');
      expect(result.content).toBe('<p>New note</p>');
      expect(result.author.firstName).toBe('Alice');
    });

    it('should default isInternal to true when not provided', async () => {
      enqueueCreateFlow();

      await service.create(createInput);

      expect(_chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ isInternal: true }),
      );
    });

    it('should respect isInternal when explicitly set to false', async () => {
      _chain._enqueue(
        [{ id: 'note-new', ...createInput, isInternal: false, createdAt: now, updatedAt: now, deletedAt: null, deletedBy: null }],
        undefined, // syncMentions delete
        [makeNoteRow({ id: 'note-new', isInternal: false })], // findByIdOrFail
      );

      await service.create({ ...createInput, isInternal: false });

      expect(_chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ isInternal: false }),
      );
    });

    it('should call extractMentionUserIds with note content', async () => {
      enqueueCreateFlow();

      await service.create(createInput);

      expect(extractMentionUserIds).toHaveBeenCalledWith('<p>New note</p>');
    });

    it('should sync mentions when content has mentioned users', async () => {
      vi.mocked(extractMentionUserIds).mockReturnValueOnce(['user-2', 'user-3']);

      _chain._enqueue(
        [{ id: 'note-new', ...createInput, isInternal: true, createdAt: now, updatedAt: now, deletedAt: null, deletedBy: null }],
        undefined, // syncMentions: delete
        undefined, // syncMentions: insert mentions
        [makeNoteRow({ id: 'note-new' })], // findByIdOrFail
      );

      await service.create(createInput);

      // insert called for note + mentions
      expect(_chain.insert).toHaveBeenCalledTimes(2);
    });

    it('should emit NOTES_NOTE_CREATED event', async () => {
      vi.mocked(extractMentionUserIds).mockReturnValueOnce(['user-2']);

      _chain._enqueue(
        [{ id: 'note-new', ...createInput, isInternal: true, createdAt: now, updatedAt: now, deletedAt: null, deletedBy: null }],
        undefined, // syncMentions: delete
        undefined, // syncMentions: insert
        [makeNoteRow({ id: 'note-new', content: '<p>New note</p>' })], // findByIdOrFail
      );

      await service.create(createInput);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTES_NOTE_CREATED,
        expect.objectContaining({
          entityType: 'notes',
          entityId: 'note-new',
          actorId: 'user-1',
          payload: expect.objectContaining({
            targetEntityType: 'candidates',
            targetEntityId: 'cand-1',
            authorId: 'user-1',
            content: '<p>New note</p>',
            isInternal: true,
            mentionedUserIds: ['user-2'],
          }),
        }),
      );
    });

    it('should emit event with empty mentionedUserIds when no mentions', async () => {
      vi.mocked(extractMentionUserIds).mockReturnValueOnce([]);
      enqueueCreateFlow();

      await service.create(createInput);

      const emitCall = eventEmitter.emit.mock.calls[0];
      expect(emitCall[1].payload.mentionedUserIds).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update content and return updated NoteWithAuthor', async () => {
      _chain._enqueue(
        [makeNoteRow()],                                        // 1. findByIdOrFail (existing)
        undefined,                                              // 2. update().set().where()
        undefined,                                              // 3. syncMentions: delete().where()
        [makeNoteRow({ content: '<p>Updated</p>' })],           // 4. findByIdOrFail (updated)
        [],                                                     // 5. getMentionUserIds
      );

      const result = await service.update('note-1', { content: '<p>Updated</p>' }, 'user-1');

      expect(result.content).toBe('<p>Updated</p>');
    });

    it('should throw ForbiddenException when actor is not author', async () => {
      _chain._enqueue([makeNoteRow({ authorId: 'user-1' })]);

      await expect(service.update('note-1', { content: 'x' }, 'user-other'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with correct message', async () => {
      _chain._enqueue([makeNoteRow({ authorId: 'user-1' })]);

      await expect(service.update('note-1', { content: 'x' }, 'user-other'))
        .rejects.toThrow('Only the author can edit this note');
    });

    it('should return existing note when no fields changed (empty update)', async () => {
      _chain._enqueue([makeNoteRow()]);

      const result = await service.update('note-1', {}, 'user-1');

      expect(result).toEqual(makeNoteWithAuthor());
      expect(_chain.update).not.toHaveBeenCalled();
    });

    it('should not emit event when no fields changed', async () => {
      _chain._enqueue([makeNoteRow()]);

      await service.update('note-1', {}, 'user-1');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should sync mentions when content is updated', async () => {
      vi.mocked(extractMentionUserIds).mockReturnValueOnce(['user-2']);

      _chain._enqueue(
        [makeNoteRow()],                                        // findByIdOrFail
        undefined,                                              // update
        undefined,                                              // syncMentions: delete
        undefined,                                              // syncMentions: insert
        [makeNoteRow({ content: '<p>Updated</p>' })],           // findByIdOrFail (updated)
        [{ userId: 'user-2' }],                                 // getMentionUserIds
      );

      await service.update('note-1', { content: '<p>Updated</p>' }, 'user-1');

      expect(extractMentionUserIds).toHaveBeenCalledWith('<p>Updated</p>');
    });

    it('should not sync mentions when only isInternal changes', async () => {
      _chain._enqueue(
        [makeNoteRow()],                                        // findByIdOrFail
        undefined,                                              // update
        [makeNoteRow({ isInternal: false })],                   // findByIdOrFail (updated)
        [],                                                     // getMentionUserIds
      );

      await service.update('note-1', { isInternal: false }, 'user-1');

      expect(extractMentionUserIds).not.toHaveBeenCalled();
    });

    it('should emit NOTES_NOTE_UPDATED with before/after snapshots', async () => {
      _chain._enqueue(
        [makeNoteRow({ content: '<p>Old</p>', isInternal: true })],  // findByIdOrFail
        undefined,                                                    // update
        undefined,                                                    // syncMentions: delete
        [makeNoteRow({ content: '<p>New</p>', isInternal: true })],  // findByIdOrFail (updated)
        [{ userId: 'user-2' }],                                      // getMentionUserIds
      );

      await service.update('note-1', { content: '<p>New</p>' }, 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTES_NOTE_UPDATED,
        expect.objectContaining({
          entityType: 'notes',
          entityId: 'note-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            before: { content: '<p>Old</p>', isInternal: true },
            after: { content: '<p>New</p>', isInternal: true },
            mentionedUserIds: ['user-2'],
          }),
        }),
      );
    });

    it('should throw NotFoundException when note does not exist', async () => {
      _chain._enqueue([]);

      await expect(service.update('nonexistent', { content: 'x' }, 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should update isInternal field', async () => {
      _chain._enqueue(
        [makeNoteRow({ isInternal: true })],                    // findByIdOrFail
        undefined,                                              // update
        [makeNoteRow({ isInternal: false })],                   // findByIdOrFail (updated)
        [],                                                     // getMentionUserIds
      );

      const result = await service.update('note-1', { isInternal: false }, 'user-1');

      expect(result.isInternal).toBe(false);
      expect(_chain.set).toHaveBeenCalledWith({ isInternal: false });
    });
  });

  // ──────────────────────────────────────────────────────────
  // softDelete()
  // ──────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should soft-delete note when actor is author', async () => {
      _chain._enqueue(
        [makeNoteRow({ authorId: 'user-1' })],                 // findByIdOrFail
        undefined,                                              // update().set().where()
      );

      await service.softDelete('note-1', 'user-1');

      expect(_chain.update).toHaveBeenCalled();
      expect(_chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: 'user-1',
        }),
      );
    });

    it('should throw ForbiddenException when actor is not author', async () => {
      _chain._enqueue([makeNoteRow({ authorId: 'user-1' })]);

      await expect(service.softDelete('note-1', 'user-other'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with correct message', async () => {
      _chain._enqueue([makeNoteRow({ authorId: 'user-1' })]);

      await expect(service.softDelete('note-1', 'user-other'))
        .rejects.toThrow('Only the author can delete this note');
    });

    it('should emit NOTES_NOTE_DELETED event', async () => {
      _chain._enqueue(
        [makeNoteRow({ authorId: 'user-1', entityType: 'candidates', entityId: 'cand-1' })],
        undefined,
      );

      await service.softDelete('note-1', 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTES_NOTE_DELETED,
        expect.objectContaining({
          entityType: 'notes',
          entityId: 'note-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            targetEntityType: 'candidates',
            targetEntityId: 'cand-1',
            authorId: 'user-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException when note does not exist', async () => {
      _chain._enqueue([]);

      await expect(service.softDelete('nonexistent', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────
  // listForEntity()
  // ──────────────────────────────────────────────────────────

  describe('listForEntity', () => {
    it('should return paginated response with correct meta', async () => {
      const row = makeNoteRow();
      // Promise.all runs two queries concurrently.
      // Data query: select().from().innerJoin().where().orderBy().limit().offset() → await
      // Count query: select().from().where() → await
      // Both chains share the same mock, so we enqueue two results:
      // the data query's await resolves first, then the count query's await.
      _chain._enqueue(
        [row],           // data query result
        [{ total: 1 }],  // count query result
      );

      const result = await service.listForEntity('candidates', 'cand-1', 1, 25);

      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('note-1');
      expect(result.data[0].author.firstName).toBe('Alice');
    });

    it('should calculate offset correctly for page > 1', async () => {
      _chain._enqueue([], [{ total: 30 }]);

      await service.listForEntity('candidates', 'cand-1', 3, 10);

      expect(_chain.offset).toHaveBeenCalledWith(20);
    });

    it('should default to page 1 and limit 25', async () => {
      _chain._enqueue([], [{ total: 0 }]);

      const result = await service.listForEntity('candidates', 'cand-1');

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
      expect(_chain.offset).toHaveBeenCalledWith(0);
    });

    it('should return empty data when no notes exist', async () => {
      _chain._enqueue([], [{ total: 0 }]);

      const result = await service.listForEntity('candidates', 'cand-1');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly (ceiling division)', async () => {
      _chain._enqueue([], [{ total: 11 }]);

      const result = await service.listForEntity('candidates', 'cand-1', 1, 5);

      expect(result.meta.totalPages).toBe(3); // ceil(11/5)
    });

    it('should order by createdAt descending', async () => {
      _chain._enqueue([], [{ total: 0 }]);

      await service.listForEntity('candidates', 'cand-1');

      expect(_chain.orderBy).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // listMentionsForUser()
  // ──────────────────────────────────────────────────────────

  describe('listMentionsForUser', () => {
    it('should return paginated mentions for user', async () => {
      _chain._enqueue([makeNoteRow()], [{ total: 1 }]);

      const result = await service.listMentionsForUser('user-1', 1, 25);

      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('note-1');
    });

    it('should return empty results when user has no mentions', async () => {
      _chain._enqueue([], [{ total: 0 }]);

      const result = await service.listMentionsForUser('user-1');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should calculate offset for page > 1', async () => {
      _chain._enqueue([], [{ total: 50 }]);

      await service.listMentionsForUser('user-1', 3, 10);

      expect(_chain.offset).toHaveBeenCalledWith(20);
    });

    it('should default to page 1 and limit 25', async () => {
      _chain._enqueue([], [{ total: 0 }]);

      const result = await service.listMentionsForUser('user-1');

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
    });

    it('should use innerJoin for both notes and users tables', async () => {
      _chain._enqueue([], [{ total: 0 }]);

      await service.listMentionsForUser('user-1');

      // Data query uses two innerJoins (notes + users)
      expect(_chain.innerJoin).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // getMentionUserIds()
  // ──────────────────────────────────────────────────────────

  describe('getMentionUserIds', () => {
    it('should return array of user IDs for note mentions', async () => {
      _chain._enqueue([{ userId: 'user-2' }, { userId: 'user-3' }]);

      const result = await service.getMentionUserIds('note-1');

      expect(result).toEqual(['user-2', 'user-3']);
    });

    it('should return empty array when no mentions exist', async () => {
      _chain._enqueue([]);

      const result = await service.getMentionUserIds('note-1');

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────
  // softDeleteAllForEntity()
  // ──────────────────────────────────────────────────────────

  describe('softDeleteAllForEntity', () => {
    it('should soft-delete all notes for entity', async () => {
      _chain._enqueue(undefined); // update().set().where()

      await service.softDeleteAllForEntity('candidates', 'cand-1', 'user-1');

      expect(_chain.update).toHaveBeenCalled();
      expect(_chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: 'user-1',
        }),
      );
    });

    it('should use provided transaction when given', async () => {
      const txResolveQueue: unknown[] = [undefined];
      const txChain: Record<string, any> = {};
      for (const m of ['update', 'set', 'where']) {
        txChain[m] = vi.fn().mockReturnValue(txChain);
      }
      txChain.then = (resolve: (v: unknown) => void) => {
        resolve(txResolveQueue.shift());
      };

      await service.softDeleteAllForEntity('candidates', 'cand-1', 'user-1', txChain);

      expect(txChain.update).toHaveBeenCalled();
      expect(txChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: 'user-1',
        }),
      );
      // Should NOT use the service db
      expect(_chain.update).not.toHaveBeenCalled();
    });

    it('should use service db when no transaction provided', async () => {
      _chain._enqueue(undefined);

      await service.softDeleteAllForEntity('candidates', 'cand-1', 'user-1');

      expect(_chain.update).toHaveBeenCalled();
    });
  });
});
