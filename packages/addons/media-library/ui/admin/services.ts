import type { ApiFn } from '@packages/platform-ui';
import type { MediaAssetRecord, Paginated, UpdateMediaAssetInput } from './types';

export function createMediaAssetsApi(api: ApiFn) {
  return {
    listAssets(params: { page?: number; limit?: number; search?: string } = {}): Promise<Paginated<MediaAssetRecord>> {
      const qs = new URLSearchParams();
      if (params.page && params.page > 1) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.search) qs.set('search', params.search);
      qs.set('_sort', '-createdAt');
      const suffix = qs.toString() ? `?${qs}` : '';
      return api.get(`/media-assets${suffix}`);
    },

    getAsset(id: string): Promise<MediaAssetRecord> {
      return api.get(`/media-assets/${id}`);
    },

    updateAsset(id: string, input: UpdateMediaAssetInput): Promise<MediaAssetRecord> {
      return api.patch(`/media-assets/${id}`, input);
    },

    deleteAsset(id: string): Promise<void> {
      return api.delete(`/media-assets/${id}`);
    },
  };
}

export type MediaAssetsApi = ReturnType<typeof createMediaAssetsApi>;
