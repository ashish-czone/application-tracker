import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '@packages/platform-ui';
import type { AttachmentWithUploader } from './types';

export function createAttachmentsApi(api: ApiFn) {
  return {
    listAttachments(params: { entityType: string; entityId: string; page?: number; limit?: number }): Promise<PaginatedResponse<AttachmentWithUploader>> {
      const searchParams = new URLSearchParams();
      searchParams.set('entityType', params.entityType);
      searchParams.set('entityId', params.entityId);
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      return api.get<PaginatedResponse<AttachmentWithUploader>>(`/attachments?${searchParams.toString()}`);
    },

    deleteAttachment(id: string): Promise<void> {
      return api.delete<void>(`/attachments/${id}`);
    },

    getDownloadUrl(id: string): Promise<{ url: string }> {
      return api.get<{ url: string }>(`/attachments/${id}/url`);
    },
  };
}

export type AttachmentsUiApi = ReturnType<typeof createAttachmentsApi>;
