export { NotesModule } from './notes.module';
export { NotesService } from './services/notes.service';
export { NOTES_PERMISSIONS } from './permissions';
export type { Note, NoteMention, NoteAuthor, NoteWithAuthor } from './types';
export { notes, noteMentions } from './schema';
export {
  NOTES_NOTE_CREATED,
  NOTES_NOTE_UPDATED,
  NOTES_NOTE_DELETED,
} from './events/types';
export type {
  NoteCreatedPayload,
  NoteUpdatedPayload,
  NoteDeletedPayload,
  NoteCreatedEvent,
  NoteUpdatedEvent,
  NoteDeletedEvent,
} from './events/types';
