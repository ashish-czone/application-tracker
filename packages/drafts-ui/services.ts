import type { ApiFn } from '@packages/platform-ui/PlatformUIProvider';
import type { Draft, SaveDraftRequest } from './types';

export function createDraftsApi(api: ApiFn) {
  return {
    saveDraft(data: SaveDraftRequest): Promise<Draft> {
      return api.post<Draft>('/drafts', data);
    },

    getDraft(entityType: string, draftKey: string): Promise<Draft | null> {
      return api.get<Draft | null>(`/drafts/${entityType}/${draftKey}`);
    },

    listDrafts(entityType?: string): Promise<Draft[]> {
      const qs = entityType ? `?entityType=${entityType}` : '';
      return api.get<Draft[]>(`/drafts${qs}`);
    },

    deleteDraft(entityType: string, draftKey: string): Promise<void> {
      return api.delete<void>(`/drafts/${entityType}/${draftKey}`);
    },
  };
}

export type DraftsUiApi = ReturnType<typeof createDraftsApi>;
