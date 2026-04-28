import { apiClient } from '../helpers/api-client';
import { postMultipart } from '../helpers/upload';

export interface Attachment {
  id: string;
  entityType: string;
  entityId: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

export interface AttachmentList {
  data: Attachment[];
  meta?: { total: number };
}

/** Upload a small in-memory CSV as an attachment of the given entity.
 *  Compliance filings whitelist `text/csv` along with PDFs / Office docs
 *  in `COMPLIANCE_ATTACHMENT_MIME_TYPES`. CSV is the lightest in-memory
 *  payload that survives the MIME guard — content can be arbitrary text. */
export async function uploadFilingAttachment(opts: {
  entityType?: string;
  entityId: string;
  fileName?: string;
  content?: string;
  mimeType?: string;
}): Promise<Attachment> {
  return postMultipart<Attachment>('/attachments/upload', {
    entityType: opts.entityType ?? 'compliance-filings',
    entityId: opts.entityId,
  }, {
    name: opts.fileName ?? 'e2e-attachment.csv',
    mimeType: opts.mimeType ?? 'text/csv',
    content: opts.content ?? 'col_a,col_b\nrow1,row2\n',
  });
}

export async function listFilingAttachments(filingId: string): Promise<AttachmentList> {
  return apiClient.get<AttachmentList>(
    `/attachments?entityType=compliance-filings&entityId=${filingId}`,
  );
}

export async function deleteAttachment(id: string): Promise<void> {
  await apiClient.delete(`/attachments/${id}`);
}
