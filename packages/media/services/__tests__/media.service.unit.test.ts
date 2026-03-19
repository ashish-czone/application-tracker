import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MediaService } from '../media.service';
import type { MediaModuleConfig, UploadedFile, MediaFieldConfig, MediaFile } from '../../types';

function createService(config?: Partial<MediaModuleConfig>): MediaService {
  const fullConfig: MediaModuleConfig = {
    provider: 'local',
    localPath: '/tmp/test-uploads',
    baseUrl: 'http://localhost:3000/uploads',
    ...config,
  };
  return new MediaService(fullConfig);
}

function createFile(overrides?: Partial<UploadedFile>): UploadedFile {
  return {
    buffer: Buffer.from('test'),
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    ...overrides,
  };
}

function createFieldConfig(overrides?: Partial<MediaFieldConfig>): MediaFieldConfig {
  return {
    entityType: 'users',
    entityId: 'user-123',
    fieldName: 'avatar',
    maxFiles: 1,
    accept: ['image/*'],
    ...overrides,
  };
}

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(() => {
    service = createService();
    // Mock the internal provider
    const provider = (service as any).provider;
    vi.spyOn(provider, 'upload').mockResolvedValue(undefined);
    vi.spyOn(provider, 'delete').mockResolvedValue(undefined);
  });

  describe('upload', () => {
    it('returns correct MediaFile metadata', async () => {
      const result = await service.upload(createFile(), createFieldConfig());

      expect(result.key).toMatch(/^users\/user-123\/avatar\/[0-9a-f-]+\.jpg$/);
      expect(result.originalName).toBe('photo.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.size).toBe(1024);
      expect(result.uploadedAt).toBeDefined();
    });

    it('rejects invalid mime type', async () => {
      const file = createFile({ mimetype: 'application/pdf' });
      const config = createFieldConfig({ accept: ['image/*'] });

      await expect(service.upload(file, config)).rejects.toThrow(BadRequestException);
    });

    it('rejects file exceeding max size', async () => {
      const file = createFile({ size: 20 * 1024 * 1024 });
      const config = createFieldConfig({ maxFileSize: 5 * 1024 * 1024 });

      await expect(service.upload(file, config)).rejects.toThrow(BadRequestException);
    });

    it('uses global maxFileSize when field config does not override', async () => {
      service = createService({ maxFileSize: 1000 });
      const provider = (service as any).provider;
      vi.spyOn(provider, 'upload').mockResolvedValue(undefined);

      const file = createFile({ size: 2000 });
      await expect(service.upload(file, createFieldConfig())).rejects.toThrow(BadRequestException);
    });

    it('accepts file within size limit', async () => {
      const file = createFile({ size: 1024 });
      const config = createFieldConfig({ maxFileSize: 2048 });

      const result = await service.upload(file, config);
      expect(result.size).toBe(1024);
    });
  });

  describe('uploadSingle', () => {
    it('deletes old file when replacing', async () => {
      const provider = (service as any).provider;
      const deleteSpy = vi.spyOn(provider, 'delete');

      const existingFile: MediaFile = {
        key: 'users/user-123/avatar/old.jpg',
        originalName: 'old.jpg',
        mimeType: 'image/jpeg',
        size: 500,
        uploadedAt: '2026-01-01T00:00:00.000Z',
      };

      await service.uploadSingle(createFile(), createFieldConfig(), existingFile);

      expect(deleteSpy).toHaveBeenCalledWith('users/user-123/avatar/old.jpg');
    });

    it('works without existing file', async () => {
      const result = await service.uploadSingle(createFile(), createFieldConfig(), null);
      expect(result.key).toBeDefined();
    });

    it('does not throw if old file deletion fails', async () => {
      const provider = (service as any).provider;
      vi.spyOn(provider, 'delete').mockRejectedValue(new Error('not found'));

      const existingFile: MediaFile = {
        key: 'old.jpg',
        originalName: 'old.jpg',
        mimeType: 'image/jpeg',
        size: 500,
        uploadedAt: '2026-01-01T00:00:00.000Z',
      };

      const result = await service.uploadSingle(createFile(), createFieldConfig(), existingFile);
      expect(result.key).toBeDefined();
    });
  });

  describe('uploadMulti', () => {
    it('rejects when at max file count', async () => {
      const existingFiles: MediaFile[] = [
        { key: '1.jpg', originalName: '1.jpg', mimeType: 'image/jpeg', size: 100, uploadedAt: '' },
        { key: '2.jpg', originalName: '2.jpg', mimeType: 'image/jpeg', size: 100, uploadedAt: '' },
      ];

      const config = createFieldConfig({ maxFiles: 2 });

      await expect(service.uploadMulti(createFile(), config, existingFiles)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows upload when under max file count', async () => {
      const existingFiles: MediaFile[] = [
        { key: '1.jpg', originalName: '1.jpg', mimeType: 'image/jpeg', size: 100, uploadedAt: '' },
      ];

      const config = createFieldConfig({ maxFiles: 5 });
      const result = await service.uploadMulti(createFile(), config, existingFiles);
      expect(result.key).toBeDefined();
    });
  });

  describe('delete', () => {
    it('delegates to provider', async () => {
      const provider = (service as any).provider;
      const deleteSpy = vi.spyOn(provider, 'delete');

      await service.delete('some/key.jpg');
      expect(deleteSpy).toHaveBeenCalledWith('some/key.jpg');
    });
  });

  describe('deleteMany', () => {
    it('deletes all files best-effort', async () => {
      const provider = (service as any).provider;
      const deleteSpy = vi.spyOn(provider, 'delete').mockResolvedValue(undefined);

      const files: MediaFile[] = [
        { key: '1.jpg', originalName: '1.jpg', mimeType: 'image/jpeg', size: 100, uploadedAt: '' },
        { key: '2.jpg', originalName: '2.jpg', mimeType: 'image/jpeg', size: 100, uploadedAt: '' },
      ];

      await service.deleteMany(files);
      expect(deleteSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('URL generation', () => {
    it('getPublicUrl delegates to provider', () => {
      const url = service.getPublicUrl('users/123/avatar/file.jpg');
      expect(url).toBe('http://localhost:3000/uploads/users/123/avatar/file.jpg');
    });
  });
});
