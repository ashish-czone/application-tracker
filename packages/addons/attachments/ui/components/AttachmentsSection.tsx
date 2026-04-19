import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@packages/ui';
import { useAuth } from '@packages/auth-ui/hooks/useAuth';
import { useEntityConfig } from '@packages/entity-engine-ui';
import { useAttachments, useUploadAttachment, useDeleteAttachment, useDownloadUrl } from '../hooks';
import { AttachmentUpload } from './AttachmentUpload';
import { AttachmentsList } from './AttachmentsList';

interface AttachmentsSectionProps {
  entityType: string;
  entityId: string;
}

export function AttachmentsSection({ entityType, entityId }: AttachmentsSectionProps) {
  const [page, setPage] = useState(1);
  const { user } = useAuth();

  // Read entity config for attachment restrictions
  const entityConfig = useEntityConfig(entityType);
  const attachmentConfig = (entityConfig?.features as Record<string, unknown>)?.attachmentConfig as { acceptedMimeTypes?: string[]; maxFileSize?: number } | undefined;

  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';

  const { data, isLoading } = useAttachments(entityType, entityId, page);
  const uploadMutation = useUploadAttachment(apiBaseUrl);
  const deleteMutation = useDeleteAttachment();
  const downloadMutation = useDownloadUrl();

  const handleFileSelect = useCallback((file: File) => {
    uploadMutation.mutate({ entityType, entityId, file });
  }, [uploadMutation, entityType, entityId]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleDownload = useCallback((id: string) => {
    downloadMutation.mutate(id, {
      onSuccess: (data) => {
        window.open(data.url, '_blank');
      },
    });
  }, [downloadMutation]);

  if (!user) return null;

  const attachments = data?.data ?? [];
  const meta = data?.meta;
  const hasNextPage = meta ? meta.page < meta.totalPages : false;
  const hasPrevPage = page > 1;

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <AttachmentUpload
        onFileSelect={handleFileSelect}
        isUploading={uploadMutation.isPending}
        acceptedMimeTypes={attachmentConfig?.acceptedMimeTypes}
        maxFileSize={attachmentConfig?.maxFileSize}
      />

      {/* Attachments list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border animate-pulse">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AttachmentsList
          attachments={attachments}
          currentUserId={user.userId}
          onDelete={handleDelete}
          onDownload={handleDownload}
          isDeleting={deleteMutation.isPending}
        />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} files)
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
