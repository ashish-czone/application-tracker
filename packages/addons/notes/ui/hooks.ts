import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { createNotesApi } from './services';
import type { CreateNoteRequest, UpdateNoteRequest } from './types';

function useNotesApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createNotesApi(apiFn), [apiFn]);
}

export function useNotes(entityType: string, entityId: string, page = 1) {
  const api = useNotesApi();
  return useQuery({
    queryKey: ['notes', entityType, entityId, page],
    queryFn: () => api.listNotes({ entityType, entityId, page }),
    enabled: !!entityType && !!entityId,
  });
}

export function useCreateNote() {
  const api = useNotesApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNoteRequest) => api.createNote(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.entityType, variables.entityId] });
      toast.success('Note added');
    },
  });
}

export function useUpdateNote() {
  const api = useNotesApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNoteRequest }) => api.updateNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note updated');
    },
  });
}

export function useDeleteNote() {
  const api = useNotesApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note deleted');
    },
  });
}

export function useMyMentions(page = 1) {
  const api = useNotesApi();
  return useQuery({
    queryKey: ['notes', 'mentions', 'me', page],
    queryFn: () => api.listMyMentions({ page }),
  });
}
