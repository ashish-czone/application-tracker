import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, eq, isNull, desc, count } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import type { PaginatedResponse } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { users } from '@packages/database/schema';
import { notes } from '../schema/notes';
import { noteMentions } from '../schema/note-mentions';
import { extractMentionUserIds } from '../helpers/extract-mentions';
import { NOTES_NOTE_CREATED, NOTES_NOTE_UPDATED, NOTES_NOTE_DELETED, NOTES_NOTE_MENTIONED } from '../events/types';
import type { NoteWithAuthor } from '../types';

const MENTION_PREVIEW_LENGTH = 140;

function buildContentPreview(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  return trimmed.length > MENTION_PREVIEW_LENGTH
    ? `${trimmed.slice(0, MENTION_PREVIEW_LENGTH)}…`
    : trimmed;
}

@Injectable()
export class NotesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly domainEventEmitter: DomainEventEmitter,
  ) {}

  async create(data: {
    entityType: string;
    entityId: string;
    content: string;
    isInternal?: boolean;
    authorId: string;
  }): Promise<NoteWithAuthor> {
    const [note] = await this.database.db
      .insert(notes)
      .values(withTenantInsert(notes, {
        entityType: data.entityType,
        entityId: data.entityId,
        content: data.content,
        isInternal: data.isInternal ?? true,
        authorId: data.authorId,
        updatedAt: new Date(),
      }))
      .returning();

    const mentionedUserIds = extractMentionUserIds(data.content);
    await this.syncMentions(note.id, mentionedUserIds);

    this.domainEventEmitter.emit(NOTES_NOTE_CREATED, {
      entityType: 'notes',
      entityId: note.id,
      actorId: data.authorId,
      payload: {
        targetEntityType: data.entityType,
        targetEntityId: data.entityId,
        authorId: data.authorId,
        content: data.content,
        isInternal: note.isInternal,
        mentionedUserIds,
      },
    });

    // Self-mentions never produce notifications.
    const newMentionedUserIds = mentionedUserIds.filter((uid) => uid !== data.authorId);
    if (newMentionedUserIds.length > 0) {
      this.domainEventEmitter.emit(NOTES_NOTE_MENTIONED, {
        entityType: 'notes',
        entityId: note.id,
        actorId: data.authorId,
        payload: {
          noteId: note.id,
          targetEntityType: data.entityType,
          targetEntityId: data.entityId,
          authorId: data.authorId,
          newMentionedUserIds,
          contentPreview: buildContentPreview(data.content),
        },
      });
    }

    return this.findByIdOrFail(note.id);
  }

  async update(id: string, data: { content?: string; isInternal?: boolean }, actorId: string): Promise<NoteWithAuthor> {
    const existing = await this.findByIdOrFail(id);

    if (existing.authorId !== actorId) {
      throw new ForbiddenException('Only the author can edit this note');
    }

    const updateValues: Record<string, unknown> = {};
    if (data.content !== undefined) updateValues.content = data.content;
    if (data.isInternal !== undefined) updateValues.isInternal = data.isInternal;

    if (Object.keys(updateValues).length === 0) {
      return existing;
    }

    await this.database.db
      .update(notes)
      .set(updateValues)
      .where(withTenant(notes, eq(notes.id, id)));

    // Snapshot prior mentions before any sync, so we can diff (only newly-added
    // users should drive a mention notification — Q30 edit-diff).
    const priorMentionedUserIds = await this.getMentionUserIds(id);

    if (data.content !== undefined) {
      const mentionedUserIds = extractMentionUserIds(data.content);
      await this.syncMentions(id, mentionedUserIds);
    }

    const updated = await this.findByIdOrFail(id);
    const mentionedUserIds = await this.getMentionUserIds(id);

    this.domainEventEmitter.emit(NOTES_NOTE_UPDATED, {
      entityType: 'notes',
      entityId: id,
      actorId,
      payload: {
        targetEntityType: updated.entityType,
        targetEntityId: updated.entityId,
        authorId: updated.authorId,
        content: updated.content,
        isInternal: updated.isInternal,
        mentionedUserIds,
        before: { content: existing.content, isInternal: existing.isInternal },
        after: { content: updated.content, isInternal: updated.isInternal },
      },
    });

    const priorSet = new Set(priorMentionedUserIds);
    const newMentionedUserIds = mentionedUserIds.filter(
      (uid) => !priorSet.has(uid) && uid !== updated.authorId,
    );
    if (newMentionedUserIds.length > 0) {
      this.domainEventEmitter.emit(NOTES_NOTE_MENTIONED, {
        entityType: 'notes',
        entityId: id,
        actorId,
        payload: {
          noteId: id,
          targetEntityType: updated.entityType,
          targetEntityId: updated.entityId,
          authorId: updated.authorId,
          newMentionedUserIds,
          contentPreview: buildContentPreview(updated.content),
        },
      });
    }

    return updated;
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    const existing = await this.findByIdOrFail(id);

    if (existing.authorId !== actorId) {
      throw new ForbiddenException('Only the author can delete this note');
    }

    await this.database.db
      .update(notes)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(withTenant(notes, eq(notes.id, id)));

    this.domainEventEmitter.emit(NOTES_NOTE_DELETED, {
      entityType: 'notes',
      entityId: id,
      actorId,
      payload: {
        targetEntityType: existing.entityType,
        targetEntityId: existing.entityId,
        authorId: existing.authorId,
      },
    });
  }

  async findById(id: string): Promise<NoteWithAuthor | null> {
    const [row] = await this.database.db
      .select({
        id: notes.id,
        entityType: notes.entityType,
        entityId: notes.entityId,
        content: notes.content,
        isInternal: notes.isInternal,
        authorId: notes.authorId,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        deletedAt: notes.deletedAt,
        deletedBy: notes.deletedBy,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
      })
      .from(notes)
      .innerJoin(users, eq(notes.authorId, users.id))
      .where(withTenant(notes, eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);

    if (!row) return null;

    return this.toNoteWithAuthor(row);
  }

  async findByIdOrFail(id: string): Promise<NoteWithAuthor> {
    const note = await this.findById(id);
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  async listForEntity(
    entityType: string,
    entityId: string,
    page = 1,
    limit = 25,
  ): Promise<PaginatedResponse<NoteWithAuthor>> {
    const offset = (page - 1) * limit;

    const [rows, [{ total }]] = await Promise.all([
      this.database.db
        .select({
          id: notes.id,
          entityType: notes.entityType,
          entityId: notes.entityId,
          content: notes.content,
          isInternal: notes.isInternal,
          authorId: notes.authorId,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
          deletedAt: notes.deletedAt,
          deletedBy: notes.deletedBy,
          authorFirstName: users.firstName,
          authorLastName: users.lastName,
          authorEmail: users.email,
        })
        .from(notes)
        .innerJoin(users, eq(notes.authorId, users.id))
        .where(withTenant(notes,
          eq(notes.entityType, entityType),
          eq(notes.entityId, entityId),
          isNull(notes.deletedAt),
        ))
        .orderBy(desc(notes.createdAt))
        .limit(limit)
        .offset(offset),

      this.database.db
        .select({ total: count() })
        .from(notes)
        .where(withTenant(notes,
          eq(notes.entityType, entityType),
          eq(notes.entityId, entityId),
          isNull(notes.deletedAt),
        )),
    ]);

    return {
      data: rows.map((row) => this.toNoteWithAuthor(row)),
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async listMentionsForUser(
    userId: string,
    page = 1,
    limit = 25,
  ): Promise<PaginatedResponse<NoteWithAuthor>> {
    const offset = (page - 1) * limit;

    const [rows, [{ total }]] = await Promise.all([
      this.database.db
        .select({
          id: notes.id,
          entityType: notes.entityType,
          entityId: notes.entityId,
          content: notes.content,
          isInternal: notes.isInternal,
          authorId: notes.authorId,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
          deletedAt: notes.deletedAt,
          deletedBy: notes.deletedBy,
          authorFirstName: users.firstName,
          authorLastName: users.lastName,
          authorEmail: users.email,
        })
        .from(noteMentions)
        .innerJoin(notes, eq(noteMentions.noteId, notes.id))
        .innerJoin(users, eq(notes.authorId, users.id))
        .where(withTenant(noteMentions,
          eq(noteMentions.userId, userId),
          isNull(notes.deletedAt),
        ))
        .orderBy(desc(notes.createdAt))
        .limit(limit)
        .offset(offset),

      this.database.db
        .select({ total: count() })
        .from(noteMentions)
        .innerJoin(notes, eq(noteMentions.noteId, notes.id))
        .where(withTenant(noteMentions,
          eq(noteMentions.userId, userId),
          isNull(notes.deletedAt),
        )),
    ]);

    return {
      data: rows.map((row) => this.toNoteWithAuthor(row)),
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  /** Returns the mention user IDs for a given note (for event payloads) */
  async getMentionUserIds(noteId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ userId: noteMentions.userId })
      .from(noteMentions)
      .where(withTenant(noteMentions, eq(noteMentions.noteId, noteId)));
    return rows.map((r) => r.userId);
  }

  /** Soft-delete all notes for an entity (called by cleanup listener on entity deletion). */
  async softDeleteAllForEntity(entityType: string, entityId: string, actorId: string, tx?: any): Promise<void> {
    const db = tx ?? this.database.db;
    await db
      .update(notes)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(withTenant(notes,
        eq(notes.entityType, entityType),
        eq(notes.entityId, entityId),
        isNull(notes.deletedAt),
      ));
  }

  private async syncMentions(noteId: string, userIds: string[]): Promise<void> {
    // Delete existing mentions
    await this.database.db
      .delete(noteMentions)
      .where(withTenant(noteMentions, eq(noteMentions.noteId, noteId)));

    // Insert new mentions
    if (userIds.length > 0) {
      await this.database.db
        .insert(noteMentions)
        .values(withTenantInsert(noteMentions, userIds.map((userId) => ({ noteId, userId }))));
    }
  }

  private toNoteWithAuthor(row: {
    id: string;
    entityType: string;
    entityId: string;
    content: string;
    isInternal: boolean;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    deletedBy: string | null;
    authorFirstName: string;
    authorLastName: string;
    authorEmail: string;
  }): NoteWithAuthor {
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
}
