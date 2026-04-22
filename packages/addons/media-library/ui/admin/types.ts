/**
 * UI-side types for the media-library admin package. Frontend defines its
 * own shapes rather than importing from the API package — the API is the
 * boundary. Keep these mirrored by hand against the wire shape.
 */

export interface MediaAssetRecord {
  id: string;
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMediaAssetInput {
  altText?: string | null;
  caption?: string | null;
}

export interface UploadMediaAssetInput {
  file: File;
  altText?: string;
  caption?: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
