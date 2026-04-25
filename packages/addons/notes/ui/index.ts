export { NotesSection } from './components/NotesSection';
export { useNotes, useCreateNote, useUpdateNote, useDeleteNote, useMyMentions } from './hooks';
export { createNotesApi, type NotesUiApi } from './services';
export type { NoteWithAuthor, NoteAuthor, CreateNoteRequest, UpdateNoteRequest } from './types';
export { NOTES_FEATURE_KEY, readNotesFeature } from './feature';
export type { NotesFeatureValue } from './feature';
export { notesDetailTab, notesSidebarPanel } from './plugins';
