import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { tokenStore } from '@packages/auth-ui/tokenStore';
import { createMediaAssetsApi } from './services';
import type { MediaAssetRecord, UpdateMediaAssetInput, UploadMediaAssetInput } from './types';

function useMediaAssetsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createMediaAssetsApi(apiFn), [apiFn]);
}

export function useMediaAssets(params: { page?: number; limit?: number; search?: string } = {}) {
  const api = useMediaAssetsApi();
  return useQuery({
    queryKey: ['media-assets', 'list', params],
    queryFn: () => api.listAssets(params),
  });
}

export function useMediaAsset(id: string | undefined) {
  const api = useMediaAssetsApi();
  return useQuery({
    queryKey: ['media-assets', 'detail', id],
    queryFn: () => api.getAsset(id!),
    enabled: !!id,
  });
}

export function useUpdateMediaAsset() {
  const api = useMediaAssetsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMediaAssetInput }) => api.updateAsset(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['media-assets', 'list'] });
      qc.invalidateQueries({ queryKey: ['media-assets', 'detail', vars.id] });
      toast.success('Media asset updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Update failed');
    },
  });
}

export function useDeleteMediaAsset() {
  const api = useMediaAssetsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-assets', 'list'] });
      toast.success('Media asset deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Delete failed');
    },
  });
}

/**
 * Upload uses raw fetch (not ApiFn) because multipart/form-data requires
 * the browser to set the Content-Type boundary automatically.
 */
export function useUploadMediaAsset(baseUrl: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadMediaAssetInput): Promise<MediaAssetRecord> => {
      const formData = new FormData();
      formData.append('file', input.file);
      if (input.altText) formData.append('altText', input.altText);
      if (input.caption) formData.append('caption', input.caption);

      const headers: Record<string, string> = {};
      const accessToken = tokenStore.getAccessToken();
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(`${baseUrl}/media-assets/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || `Upload failed (${res.status})`);
      }

      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-assets', 'list'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Upload failed');
    },
  });
}
