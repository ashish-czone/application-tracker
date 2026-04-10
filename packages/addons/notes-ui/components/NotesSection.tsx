import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui/PlatformUIProvider';
import { useAuth } from '@packages/platform-ui/auth/hooks/useAuth';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../hooks';
import { NoteEditor } from './NoteEditor';
import { NotesList } from './NotesList';

interface NotesSectionProps {
  entityType: string;
  entityId: string;
}

export function NotesSection({ entityType, entityId }: NotesSectionProps) {
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const apiFn = usePlatformAPI();

  const { data, isLoading } = useNotes(entityType, entityId, page);
  const createMutation = useCreateNote();
  const updateMutation = useUpdateNote();
  const deleteMutation = useDeleteNote();

  const searchUsers = useCallback(async (query: string): Promise<{ id: string; label: string }[]> => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(
      `/users?search=${encodeURIComponent(query)}&limit=10`,
    );
    return res.data.map((u) => ({
      id: u.id,
      label: `${u.firstName} ${u.lastName}`.trim(),
    }));
  }, [apiFn]);

  const handleCreate = useCallback((html: string) => {
    createMutation.mutate({ entityType, entityId, content: html });
  }, [createMutation, entityType, entityId]);

  const handleUpdate = useCallback((id: string, content: string) => {
    updateMutation.mutate({ id, data: { content } });
  }, [updateMutation]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  if (!user) return null;

  const notes = data?.data ?? [];
  const meta = data?.meta;
  const hasNextPage = meta ? meta.page < meta.totalPages : false;
  const hasPrevPage = page > 1;

  return (
    <div className="space-y-4">
      {/* New note editor */}
      <NoteEditor
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
        searchUsers={searchUsers}
      />

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-4 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-12 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <NotesList
          notes={notes}
          currentUserId={user.userId}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          isUpdating={updateMutation.isPending}
          searchUsers={searchUsers}
        />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} notes)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
