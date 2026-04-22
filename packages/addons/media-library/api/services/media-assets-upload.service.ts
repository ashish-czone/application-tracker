import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { MediaService, type MediaFile, type UploadedFile } from '@packages/media';
import { mediaAssets } from '../schema/media-assets';

// Kept strict for V1. Easy to extend with image/avif, image/tiff,
// application/pdf, etc. without a schema change.
const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

// 10 MB matches the platform media default. Bumps via config if
// needed — keeping a local constant avoids cross-package coupling.
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

export interface MediaAssetUploadInput {
  file: UploadedFile;
  altText?: string;
  caption?: string;
  createdBy: string;
}

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
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MediaAssetsUploadService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly mediaService: MediaService,
    private readonly db: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(MediaAssetsUploadService.name);
  }

  /**
   * Upload a file + create a MediaAsset row in one atomic flow.
   *
   * If the DB insert fails after the file lands in storage, best-effort
   * delete the file to avoid orphans. The file stays if cleanup also
   * fails — surfaced in logs for operator attention rather than
   * swallowed, since orphan files are easier to inspect than a stuck
   * transaction.
   */
  async upload(input: MediaAssetUploadInput): Promise<MediaAssetRecord> {
    const assetId = randomUUID();

    const mediaFile = await this.mediaService.upload(input.file, {
      entityType: 'media-assets',
      entityId: assetId,
      fieldName: 'file',
      maxFiles: 1,
      maxFileSize: DEFAULT_MAX_SIZE,
      accept: [...IMAGE_MIME_TYPES],
    });

    const dimensions = await this.extractDimensions(input.file, mediaFile);
    const url = this.resolveUrl(mediaFile.key);

    try {
      const [row] = await this.db.db
        .insert(mediaAssets)
        .values({
          id: assetId,
          storageKey: mediaFile.key,
          url,
          originalName: mediaFile.originalName,
          mimeType: mediaFile.mimeType,
          size: mediaFile.size,
          width: dimensions.width,
          height: dimensions.height,
          altText: input.altText ?? null,
          caption: input.caption ?? null,
          createdBy: input.createdBy,
        })
        .returning();

      return row as MediaAssetRecord;
    } catch (err) {
      await this.cleanupOrphan(mediaFile.key);
      throw err;
    }
  }

  private async extractDimensions(
    file: UploadedFile,
    mediaFile: MediaFile,
  ): Promise<{ width: number | null; height: number | null }> {
    if (!IMAGE_MIME_TYPES.includes(mediaFile.mimeType as (typeof IMAGE_MIME_TYPES)[number])) {
      return { width: null, height: null };
    }
    // SVG dimensions via sharp are unreliable (viewBox parsing), and
    // for V1 the picker-tile aspect ratio works well enough without
    // them. Defer to null and revisit if SVGs become a common upload.
    if (mediaFile.mimeType === 'image/svg+xml') {
      return { width: null, height: null };
    }
    try {
      const metadata = await sharp(file.buffer).metadata();
      return {
        width: metadata.width ?? null,
        height: metadata.height ?? null,
      };
    } catch (err) {
      this.logger.warn(`Failed to read image dimensions for ${mediaFile.key}: ${err}`);
      return { width: null, height: null };
    }
  }

  private resolveUrl(key: string): string {
    return this.mediaService.getPublicUrl(key);
  }

  private async cleanupOrphan(key: string): Promise<void> {
    try {
      await this.mediaService.delete(key);
    } catch (err) {
      this.logger.error(`Failed to clean up orphan media file ${key}: ${err}`);
    }
  }

  /**
   * Validation guard for the controller. Kept here so the service
   * owns what "valid upload" means rather than splitting the rules
   * between service + controller.
   */
  static validateFile(file: UploadedFile | undefined): asserts file is UploadedFile {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
  }
}
