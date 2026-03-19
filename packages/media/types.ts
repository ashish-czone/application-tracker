/** Metadata stored in JSONB on entity fields */
export interface MediaFile {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

/** Per-upload field configuration */
export interface MediaFieldConfig {
  entityType: string;
  entityId: string;
  fieldName: string;
  maxFiles: number;
  maxFileSize?: number;
  accept: string[];
}

/** File input (matches Multer output without coupling to Express) */
export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Module configuration */
export interface MediaModuleConfig {
  provider: 'local' | 's3';
  localPath?: string;
  baseUrl?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3Endpoint?: string;
  s3ForcePathStyle?: boolean;
  maxFileSize?: number;
}

export interface MediaModuleAsyncOptions {
  useFactory: (...args: any[]) => MediaModuleConfig | Promise<MediaModuleConfig>;
  inject?: any[];
}

export const MEDIA_MODULE_CONFIG = Symbol('MEDIA_MODULE_CONFIG');
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
