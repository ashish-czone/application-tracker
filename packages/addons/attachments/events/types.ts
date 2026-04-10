import type { DomainEvent } from '@packages/events';

export const ATTACHMENTS_ATTACHMENT_UPLOADED = 'attachments.AttachmentUploaded' as const;
export const ATTACHMENTS_ATTACHMENT_DELETED = 'attachments.AttachmentDeleted' as const;

// --- Payload types ---

export interface AttachmentUploadedPayload {
  targetEntityType: string;
  targetEntityId: string;
  originalName: string;
  mimeType: string;
  size: number;
  [key: string]: unknown;
}

export interface AttachmentDeletedPayload {
  targetEntityType: string;
  targetEntityId: string;
  originalName: string;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [ATTACHMENTS_ATTACHMENT_UPLOADED]: AttachmentUploadedPayload;
    [ATTACHMENTS_ATTACHMENT_DELETED]: AttachmentDeletedPayload;
  }
}

// --- Full event interfaces (for consumers/listeners) ---

export interface AttachmentUploadedEvent extends DomainEvent {
  eventName: typeof ATTACHMENTS_ATTACHMENT_UPLOADED;
  entityType: 'attachments';
  payload: AttachmentUploadedPayload;
}

export interface AttachmentDeletedEvent extends DomainEvent {
  eventName: typeof ATTACHMENTS_ATTACHMENT_DELETED;
  entityType: 'attachments';
  payload: AttachmentDeletedPayload;
}
