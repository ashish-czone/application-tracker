import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui/PlatformUIProvider';
import { tokenStore } from '@packages/platform-ui/auth/tokenStore';
import { createAttachmentsApi } from './services';
import type { AttachmentWithUploader } from './types';

function useAttachmentsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createAttachmentsApi(apiFn), [apiFn]);
}

export function useAttachments(entityType: string, entityId: string, page = 1) {
  const api = useAttachmentsApi();
  return useQuery({
    queryKey: ['attachments', entityType, entityId, page],
    queryFn: () => api.listAttachments({ entityType, entityId, page }),
    enabled: !!entityType && !!entityId,
  });
}

/**
 * Upload uses raw fetch (not ApiFn) because multipart/form-data
 * requires the browser to set the Content-Type boundary automatically.
 */
export function useUploadAttachment(baseUrl: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { entityType: string; entityId: string; file: File }): Promise<AttachmentWithUploader> => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('entityType', data.entityType);
      formData.append('entityId', data.entityId);

      const headers: Record<string, string> = {};
      const accessToken = tokenStore.getAccessToken();
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(`${baseUrl}/attachments/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || 'Upload failed');
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.entityType, variables.entityId] });
      toast.success('File uploaded');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Upload failed');
    },
  });
}

export function useDeleteAttachment() {
  const api = useAttachmentsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAttachment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      toast.success('Attachment deleted');
    },
  });
}

export function useDownloadUrl() {
  const api = useAttachmentsApi();
  return useMutation({
    mutationFn: (id: string) => api.getDownloadUrl(id),
  });
}
