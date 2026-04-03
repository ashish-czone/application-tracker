import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '@packages/platform-ui/PlatformUIProvider';
import type { NoteWithAuthor, CreateNoteRequest, UpdateNoteRequest } from './types';

export function createNotesApi(api: ApiFn) {
  return {
    listNotes(params: { entityType: string; entityId: string; page?: number; limit?: number }): Promise<PaginatedResponse<NoteWithAuthor>> {
      const searchParams = new URLSearchParams();
      searchParams.set('entityType', params.entityType);
      searchParams.set('entityId', params.entityId);
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      return api.get<PaginatedResponse<NoteWithAuthor>>(`/notes?${searchParams.toString()}`);
    },

    createNote(data: CreateNoteRequest): Promise<NoteWithAuthor> {
      return api.post<NoteWithAuthor>('/notes', data);
    },

    updateNote(id: string, data: UpdateNoteRequest): Promise<NoteWithAuthor> {
      return api.patch<NoteWithAuthor>(`/notes/${id}`, data);
    },

    deleteNote(id: string): Promise<void> {
      return api.delete<void>(`/notes/${id}`);
    },

    listMyMentions(params: { page?: number; limit?: number }): Promise<PaginatedResponse<NoteWithAuthor>> {
      const searchParams = new URLSearchParams();
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      const qs = searchParams.toString();
      return api.get<PaginatedResponse<NoteWithAuthor>>(`/notes/mentions/me${qs ? `?${qs}` : ''}`);
    },
  };
}

export type NotesUiApi = ReturnType<typeof createNotesApi>;
