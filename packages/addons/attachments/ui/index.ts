export { AttachmentsSection } from './components/AttachmentsSection';
export { useAttachments, useUploadAttachment, useDeleteAttachment, useDownloadUrl } from './hooks';
export { createAttachmentsApi, type AttachmentsUiApi } from './services';
export type { AttachmentWithUploader, AttachmentUploader } from './types';
export { ATTACHMENTS_FEATURE_KEY, readAttachmentsFeature } from './feature';
export type { AttachmentsFeatureValue } from './feature';
export { attachmentsDetailTab, attachmentsSidebarPanel } from './plugins';
