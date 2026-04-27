export { AttachmentsModule } from './attachments.module';

export const attachmentsAddon = {
  module: () => require('./attachments.module').AttachmentsModule,
  migration: '@packages/attachments',
} as const;
export { ATTACHMENTS_FEATURE_KEY, attachmentsFeature, readAttachmentsFeature } from './feature';
export type { AttachmentsFeatureConfig, AttachmentsFeatureValue } from './feature';
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
