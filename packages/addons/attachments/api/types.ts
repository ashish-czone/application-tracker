export interface Attachment {
  id: string;
  entityType: string;
  entityId: string;
  fileKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface AttachmentUploader {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AttachmentWithUploader extends Attachment {
  uploader: AttachmentUploader;
}

export interface AttachmentConfig {
  maxFileSize?: number;
  acceptedMimeTypes?: string[];
  deleteMode?: 'soft' | 'hard';
}
