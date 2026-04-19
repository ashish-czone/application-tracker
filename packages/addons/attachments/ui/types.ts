export interface AttachmentUploader {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AttachmentWithUploader {
  id: string;
  entityType: string;
  entityId: string;
  fileKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  uploader: AttachmentUploader;
}
