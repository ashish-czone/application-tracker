import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MediaService } from '../media.service';
import type { MediaModuleConfig, UploadedFile, MediaFile } from '../../types';
import type { AppLoggerService } from '@packages/logger';

vi.mock('../../providers/local.provider', () => ({
  LocalMediaProvider: vi.fn().mockImplementation(() => ({
    name: 'local',
    upload: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue('https://signed-url'),
    getPublicUrl: vi.fn().mockReturnValue('http://localhost:3000/uploads/key'),
  })),
}));

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

const mockConfig: MediaModuleConfig = {
  provider: 'local',
  localPath: './uploads',
  baseUrl: 'http://localhost:3000/uploads',
};

function createService(configOverrides?: Partial<MediaModuleConfig>): MediaService {
  return new MediaService({ ...mockConfig, ...configOverrides }, createMockAppLogger());
}

function createFile(overrides?: Partial<UploadedFile>): UploadedFile {
  return {
    buffer: Buffer.from('file-content'),
    originalname: 'document.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    ...overrides,
  };
}

function getProvider(service: MediaService) {
  return (service as any).provider;
}

describe('MediaService — additional coverage', () => {
  let service: MediaService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ----------------------------------------------------------------
  // uploadToTmp
  // ----------------------------------------------------------------
  describe('uploadToTmp', () => {
    it('should upload a valid file and return MediaFile with tmp/ key', async () => {
      const file = createFile({ mimetype: 'application/pdf', size: 1024 });

      const result = await service.uploadToTmp(file, ['application/pdf']);

      expect(result.key).toMatch(/^tmp\/[0-9a-f-]+\.pdf$/);
      expect(result.originalName).toBe('document.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.size).toBe(1024);
      expect(result.uploadedAt).toBeDefined();
      expect(getProvider(service).upload).toHaveBeenCalledWith(
        result.key,
        file.buffer,
        'application/pdf',
      );
    });

    it('should reject file with unaccepted MIME type', async () => {
      const file = createFile({ mimetype: 'text/plain' });

      await expect(
        service.uploadToTmp(file, ['image/*', 'application/pdf']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file exceeding custom maxFileSize', async () => {
      const file = createFile({ size: 5 * 1024 * 1024 });

      await expect(
        service.uploadToTmp(file, ['application/pdf'], 1 * 1024 * 1024),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file exceeding global maxFileSize when no custom limit', async () => {
      service = createService({ maxFileSize: 500 });
      const file = createFile({ size: 1000 });

      await expect(
        service.uploadToTmp(file, ['application/pdf']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use DEFAULT_MAX_FILE_SIZE when no limits configured', async () => {
      service = createService({ maxFileSize: undefined });
      const file = createFile({ size: 1024 }); // well under 10MB default

      const result = await service.uploadToTmp(file, ['application/pdf']);

      expect(result.key).toMatch(/^tmp\//);
    });

    it('should accept wildcard MIME pattern', async () => {
      const file = createFile({ mimetype: 'image/png', originalname: 'photo.png' });

      const result = await service.uploadToTmp(file, ['image/*']);

      expect(result.mimeType).toBe('image/png');
      expect(result.key).toMatch(/^tmp\/[0-9a-f-]+\.png$/);
    });

    it('should decode Latin-1 encoded filenames', async () => {
      const utf8Name = 'r\u00e9sum\u00e9.pdf';
      const latin1Name = Buffer.from(utf8Name, 'utf8').toString('latin1');
      const file = createFile({ originalname: latin1Name });

      const result = await service.uploadToTmp(file, ['application/pdf']);

      expect(result.originalName).toBe(utf8Name);
    });
  });

  // ----------------------------------------------------------------
  // move
  // ----------------------------------------------------------------
  describe('move', () => {
    it('should move a file and return updated MediaFile with new key', async () => {
      const mediaFile: MediaFile = {
        key: 'old/path/file.pdf',
        originalName: 'file.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        uploadedAt: '2026-01-01T00:00:00.000Z',
      };

      const result = await service.move(mediaFile, 'new/path/file.pdf');

      expect(result.key).toBe('new/path/file.pdf');
      expect(result.originalName).toBe('file.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.size).toBe(2048);
      expect(result.uploadedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(getProvider(service).move).toHaveBeenCalledWith('old/path/file.pdf', 'new/path/file.pdf');
    });

    it('should preserve all metadata except key', async () => {
      const mediaFile: MediaFile = {
        key: 'a.txt',
        originalName: 'original.txt',
        mimeType: 'text/plain',
        size: 100,
        uploadedAt: '2026-03-15T12:00:00.000Z',
      };

      const result = await service.move(mediaFile, 'b.txt');

      expect(result).toEqual({ ...mediaFile, key: 'b.txt' });
    });
  });

  // ----------------------------------------------------------------
  // moveFromTmp
  // ----------------------------------------------------------------
  describe('moveFromTmp', () => {
    it('should move file from tmp/ to permanent location', async () => {
      const mediaFile: MediaFile = {
        key: 'tmp/abc-123.pdf',
        originalName: 'report.pdf',
        mimeType: 'application/pdf',
        size: 4096,
        uploadedAt: '2026-01-01T00:00:00.000Z',
      };

      const result = await service.moveFromTmp(mediaFile, 'invoices', 'inv-1', 'attachment');

      expect(result.key).toMatch(/^invoices\/inv-1\/attachment\/[0-9a-f-]+\.pdf$/);
      expect(result.key).not.toContain('tmp/');
      expect(result.originalName).toBe('report.pdf');
      expect(getProvider(service).move).toHaveBeenCalled();
    });

    it('should skip move if key does not start with tmp/', async () => {
      const mediaFile: MediaFile = {
        key: 'invoices/inv-1/attachment/existing.pdf',
        originalName: 'report.pdf',
        mimeType: 'application/pdf',
        size: 4096,
        uploadedAt: '2026-01-01T00:00:00.000Z',
      };

      const result = await service.moveFromTmp(mediaFile, 'invoices', 'inv-1', 'attachment');

      expect(result).toBe(mediaFile); // same reference, no move
      expect(getProvider(service).move).not.toHaveBeenCalled();
    });

    it('should return updated MediaFile with permanent key', async () => {
      const mediaFile: MediaFile = {
        key: 'tmp/xyz.jpg',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        uploadedAt: '2026-02-01T00:00:00.000Z',
      };

      const result = await service.moveFromTmp(mediaFile, 'users', 'u-1', 'avatar');

      expect(result.key).toMatch(/^users\/u-1\/avatar\//);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.size).toBe(1024);
    });
  });

  // ----------------------------------------------------------------
  // getSignedUrl
  // ----------------------------------------------------------------
  describe('getSignedUrl', () => {
    it('should delegate to provider and return signed URL', async () => {
      const result = await service.getSignedUrl('users/u-1/avatar/file.jpg');

      expect(result).toBe('https://signed-url');
      expect(getProvider(service).getSignedUrl).toHaveBeenCalledWith(
        'users/u-1/avatar/file.jpg',
        undefined,
      );
    });

    it('should pass expiresIn to provider', async () => {
      const result = await service.getSignedUrl('some/key.pdf', 3600);

      expect(result).toBe('https://signed-url');
      expect(getProvider(service).getSignedUrl).toHaveBeenCalledWith('some/key.pdf', 3600);
    });

    it('should work without expiresIn parameter', async () => {
      const result = await service.getSignedUrl('file.txt');

      expect(result).toBe('https://signed-url');
    });
  });
});
