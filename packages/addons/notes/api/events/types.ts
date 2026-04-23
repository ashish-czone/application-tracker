import type { DomainEvent } from '@packages/events';

export const NOTES_NOTE_CREATED = 'notes.NoteCreated' as const;
export const NOTES_NOTE_UPDATED = 'notes.NoteUpdated' as const;
export const NOTES_NOTE_DELETED = 'notes.NoteDeleted' as const;
/**
 * Fires only when mentions are *newly added* (on create, or on an edit that
 * introduces users who weren't in the prior mention list). Decouples the
 * "someone was mentioned" signal from the general create/update events so a
 * single automation rule can drive notifications without re-notifying users
 * who were already in the earlier version.
 */
export const NOTES_NOTE_MENTIONED = 'notes.NoteMentioned' as const;

// --- Payload types ---

export interface NoteCreatedPayload {
  targetEntityType: string;
  targetEntityId: string;
  authorId: string;
  content: string;
  isInternal: boolean;
  mentionedUserIds: string[];
  [key: string]: unknown;
}

export interface NoteUpdatedPayload {
  targetEntityType: string;
  targetEntityId: string;
  authorId: string;
  content: string;
  isInternal: boolean;
  mentionedUserIds: string[];
  before: { content: string; isInternal: boolean };
  after: { content: string; isInternal: boolean };
  [key: string]: unknown;
}

export interface NoteDeletedPayload {
  targetEntityType: string;
  targetEntityId: string;
  authorId: string;
  [key: string]: unknown;
}

export interface NoteMentionedPayload {
  /** The note that carried the mention. */
  noteId: string;
  /** Entity the note is attached to (e.g., compliance-filings, <id>). */
  targetEntityType: string;
  targetEntityId: string;
  authorId: string;
  /** Only the users introduced by this change — prior mentions are excluded. */
  newMentionedUserIds: string[];
  /** Short preview clip, safe for rendering in notification previews. */
  contentPreview: string;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [NOTES_NOTE_CREATED]: NoteCreatedPayload;
    [NOTES_NOTE_UPDATED]: NoteUpdatedPayload;
    [NOTES_NOTE_DELETED]: NoteDeletedPayload;
    [NOTES_NOTE_MENTIONED]: NoteMentionedPayload;
  }
}

// --- Full event interfaces (for consumers/listeners) ---

export interface NoteCreatedEvent extends DomainEvent {
  eventName: typeof NOTES_NOTE_CREATED;
  entityType: 'notes';
  payload: NoteCreatedPayload;
}

export interface NoteUpdatedEvent extends DomainEvent {
  eventName: typeof NOTES_NOTE_UPDATED;
  entityType: 'notes';
  payload: NoteUpdatedPayload;
}

export interface NoteDeletedEvent extends DomainEvent {
  eventName: typeof NOTES_NOTE_DELETED;
  entityType: 'notes';
  payload: NoteDeletedPayload;
}

export interface NoteMentionedEvent extends DomainEvent {
  eventName: typeof NOTES_NOTE_MENTIONED;
  entityType: 'notes';
  payload: NoteMentionedPayload;
}
