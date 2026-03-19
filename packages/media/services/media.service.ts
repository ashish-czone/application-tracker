import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { MediaProvider } from '../providers/media-provider.interface';
import { LocalMediaProvider } from '../providers/local.provider';
import { S3MediaProvider } from '../providers/s3.provider';
import {
  MEDIA_MODULE_CONFIG,
  DEFAULT_MAX_FILE_SIZE,
  type MediaModuleConfig,
  type MediaFile,
  type MediaFieldConfig,
  type UploadedFile,
} from '../types';
import { isMimeTypeAccepted, isFileSizeValid, generateStorageKey } from '../helpers/validation';

@Injectable()
export class MediaService {
  private readonly logger: ContextLogger;
  private readonly provider: MediaProvider;

  constructor(
    @Inject(MEDIA_MODULE_CONFIG) private readonly config: MediaModuleConfig,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(MediaService.name);
    if (config.provider === 's3') {
      this.provider = new S3MediaProvider(config);
    } else {
      this.provider = new LocalMediaProvider(
        config.localPath ?? './uploads',
        config.baseUrl ?? 'http://localhost:3000/uploads',
      );
    }
    this.logger.log(`Media provider: ${this.provider.name}`);
  }

  /**
   * Upload a single file. Validates, uploads to provider, returns MediaFile metadata.
   */
  async upload(file: UploadedFile, fieldConfig: MediaFieldConfig): Promise<MediaFile> {
    const maxSize = fieldConfig.maxFileSize ?? this.config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

    if (!isMimeTypeAccepted(file.mimetype, fieldConfig.accept)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not accepted. Allowed: ${fieldConfig.accept.join(', ')}`,
      );
    }

    if (!isFileSizeValid(file.size, maxSize)) {
      const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(`File size exceeds maximum of ${maxMB}MB`);
    }

    const key = generateStorageKey(
      fieldConfig.entityType,
      fieldConfig.entityId,
      fieldConfig.fieldName,
      file.originalname,
    );

    await this.provider.upload(key, file.buffer, file.mimetype);

    return {
      key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Upload for a single-file field. Deletes old file if replacing.
   */
  async uploadSingle(
    file: UploadedFile,
    fieldConfig: MediaFieldConfig,
    existingFile?: MediaFile | null,
  ): Promise<MediaFile> {
    const mediaFile = await this.upload(file, fieldConfig);

    if (existingFile) {
      try {
        await this.provider.delete(existingFile.key);
      } catch (err) {
        this.logger.warn(`Failed to delete old file ${existingFile.key}: ${err}`);
      }
    }

    return mediaFile;
  }

  /**
   * Upload for a multi-file field. Checks maxFiles limit.
   */
  async uploadMulti(
    file: UploadedFile,
    fieldConfig: MediaFieldConfig,
    existingFiles: MediaFile[],
  ): Promise<MediaFile> {
    if (existingFiles.length >= fieldConfig.maxFiles) {
      throw new BadRequestException(
        `Maximum of ${fieldConfig.maxFiles} files allowed`,
      );
    }

    return this.upload(file, fieldConfig);
  }

  async delete(key: string): Promise<void> {
    await this.provider.delete(key);
  }

  async deleteMany(files: MediaFile[]): Promise<void> {
    await Promise.allSettled(
      files.map((f) =>
        this.provider.delete(f.key).catch((err) => {
          this.logger.warn(`Failed to delete ${f.key}: ${err}`);
        }),
      ),
    );
  }

  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    return this.provider.getSignedUrl(key, expiresIn);
  }

  getPublicUrl(key: string): string {
    return this.provider.getPublicUrl(key);
  }
}
