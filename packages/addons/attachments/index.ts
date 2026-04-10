export { AttachmentsModule } from './attachments.module';
export { AttachmentsService } from './services/attachments.service';
export { ATTACHMENTS_PERMISSIONS } from './permissions';
export type { Attachment, AttachmentWithUploader, AttachmentUploader, AttachmentConfig } from './types';
export { attachments } from './schema';
export {
  ATTACHMENTS_ATTACHMENT_UPLOADED,
  ATTACHMENTS_ATTACHMENT_DELETED,
} from './events/types';
export type {
  AttachmentUploadedPayload,
  AttachmentDeletedPayload,
  AttachmentUploadedEvent,
  AttachmentDeletedEvent,
} from './events/types';
