import { apiClient } from '../helpers/api-client';

export interface Note {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  authorId: string;
  isInternal: boolean;
  createdAt: string;
}

export interface NoteList {
  data: Note[];
  meta?: { total: number };
}

/** Create a comment on a filing. The compliance-filings entity wires
 *  the `notesFeature` so notes attached to a filing render as comments
 *  in the detail UI. */
export async function createFilingComment(opts: {
  entityType?: string;
  entityId: string;
  content: string;
  isInternal?: boolean;
}): Promise<Note> {
  return apiClient.post<Note>('/notes', {
    entityType: opts.entityType ?? 'compliance-filings',
    entityId: opts.entityId,
    content: opts.content,
    isInternal: opts.isInternal ?? false,
  });
}

export async function listFilingComments(filingId: string): Promise<NoteList> {
  return apiClient.get<NoteList>(
    `/notes?entityType=compliance-filings&entityId=${filingId}`,
  );
}
