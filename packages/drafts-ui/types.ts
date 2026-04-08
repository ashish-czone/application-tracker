export interface Draft {
  id: string;
  entityType: string;
  draftKey: string;
  data: Record<string, unknown>;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveDraftRequest {
  entityType: string;
  draftKey: string;
  data: Record<string, unknown>;
}

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
