import type { DomainEvent } from '@packages/events';

export const NOTES_NOTE_CREATED = 'notes.NoteCreated' as const;
export const NOTES_NOTE_UPDATED = 'notes.NoteUpdated' as const;
export const NOTES_NOTE_DELETED = 'notes.NoteDeleted' as const;

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

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [NOTES_NOTE_CREATED]: NoteCreatedPayload;
    [NOTES_NOTE_UPDATED]: NoteUpdatedPayload;
    [NOTES_NOTE_DELETED]: NoteDeletedPayload;
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
