import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { MEDIA_MODULE_CONFIG } from '../../types';
import { MediaService } from '../media.service';
import type { UploadedFile, MediaFieldConfig, MediaFile } from '../../types';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('MediaService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let mediaService: MediaService;
  let tmpDir: string;

  const BASE_URL = 'http://localhost:3000/uploads';

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'media-test-'));

    const ctx = await createPlatformTestModule({
      providers: [
        {
          provide: MEDIA_MODULE_CONFIG,
          useValue: {
            provider: 'local',
            localPath: tmpDir,
            baseUrl: BASE_URL,
            maxFileSize: 10 * 1024 * 1024, // 10MB
          },
        },
        MediaService,
      ],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    mediaService = module.get(MediaService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
    await rm(tmpDir, { recursive: true, force: true });
  });

  function createFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
    return {
      buffer: Buffer.from('test file content'),
      originalname: overrides.originalname ?? 'test-file.jpg',
      mimetype: overrides.mimetype ?? 'image/jpeg',
      size: overrides.size ?? 17,
      ...overrides,
    };
  }

  function createFieldConfig(overrides: Partial<MediaFieldConfig> = {}): MediaFieldConfig {
    return {
      entityType: 'test_entity',
      entityId: 'entity-123',
      fieldName: 'avatar',
      maxFiles: 5,
      accept: ['image/*'],
      ...overrides,
    };
  }

  // ---------- upload ----------

  describe('upload', () => {
    it('should upload a file and return MediaFile metadata', async () => {
      const file = createFile();
      const config = createFieldConfig();

      const result = await mediaService.upload(file, config);

      expect(result.originalName).toBe('test-file.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.size).toBe(17);
      expect(result.uploadedAt).toBeDefined();
      expect(result.key).toMatch(/^test_entity\/entity-123\/avatar\/[a-f0-9-]+\.jpg$/);
    });

    it('should write the file to disk', async () => {
      const content = Buffer.from('hello world');
      const file = createFile({ buffer: content, size: content.length });
      const config = createFieldConfig();

      const result = await mediaService.upload(file, config);

      const filePath = join(tmpDir, result.key);
      const written = await readFile(filePath);
      expect(written.toString()).toBe('hello world');
    });

    it('should reject invalid MIME type', async () => {
      const file = createFile({ mimetype: 'application/pdf' });
      const config = createFieldConfig({ accept: ['image/*'] });

      await expect(mediaService.upload(file, config)).rejects.toThrow(
        "File type 'application/pdf' is not accepted",
      );
    });

    it('should reject file exceeding max size', async () => {
      const file = createFile({ size: 20 * 1024 * 1024 });
      const config = createFieldConfig({ maxFileSize: 5 * 1024 * 1024 });

      await expect(mediaService.upload(file, config)).rejects.toThrow(
        'File size exceeds maximum',
      );
    });

    it('should accept any type when accept list is empty', async () => {
      const file = createFile({ mimetype: 'application/octet-stream' });
      const config = createFieldConfig({ accept: [] });

      const result = await mediaService.upload(file, config);
      expect(result.mimeType).toBe('application/octet-stream');
    });

    it('should use global maxFileSize when field config has none', async () => {
      const largeSize = 11 * 1024 * 1024; // exceeds the 10MB global limit
      const file = createFile({ size: largeSize });
      const config = createFieldConfig();
      delete (config as any).maxFileSize;

      await expect(mediaService.upload(file, config)).rejects.toThrow(
        'File size exceeds maximum',
      );
    });
  });

  // ---------- uploadSingle ----------

  describe('uploadSingle', () => {
    it('should upload without existing file', async () => {
      const file = createFile();
      const config = createFieldConfig();

      const result = await mediaService.uploadSingle(file, config);
      expect(result.originalName).toBe('test-file.jpg');
    });

    it('should delete old file when replacing', async () => {
      const file1 = createFile({ buffer: Buffer.from('first'), size: 5 });
      const config = createFieldConfig();

      const first = await mediaService.uploadSingle(file1, config);
      const firstPath = join(tmpDir, first.key);
      await access(firstPath); // should exist

      const file2 = createFile({ buffer: Buffer.from('second'), size: 6, originalname: 'replacement.jpg' });
      const second = await mediaService.uploadSingle(file2, config, first);

      expect(second.originalName).toBe('replacement.jpg');

      // old file should be deleted
      await expect(access(firstPath)).rejects.toThrow();
    });

    it('should not throw if old file deletion fails', async () => {
      const file = createFile();
      const config = createFieldConfig();

      const fakeExisting: MediaFile = {
        key: 'nonexistent/path/file.jpg',
        originalName: 'old.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        uploadedAt: new Date().toISOString(),
      };

      // Should succeed despite old file not existing
      const result = await mediaService.uploadSingle(file, config, fakeExisting);
      expect(result.originalName).toBe('test-file.jpg');
    });
  });

  // ---------- uploadMulti ----------

  describe('uploadMulti', () => {
    it('should upload when under maxFiles limit', async () => {
      const file = createFile();
      const config = createFieldConfig({ maxFiles: 3 });

      const result = await mediaService.uploadMulti(file, config, []);
      expect(result.originalName).toBe('test-file.jpg');
    });

    it('should reject when at maxFiles limit', async () => {
      const file = createFile();
      const config = createFieldConfig({ maxFiles: 2 });

      const existing: MediaFile[] = [
        { key: 'a.jpg', originalName: 'a.jpg', mimeType: 'image/jpeg', size: 1, uploadedAt: '' },
        { key: 'b.jpg', originalName: 'b.jpg', mimeType: 'image/jpeg', size: 1, uploadedAt: '' },
      ];

      await expect(mediaService.uploadMulti(file, config, existing)).rejects.toThrow(
        'Maximum of 2 files allowed',
      );
    });
  });

  // ---------- uploadToTmp ----------

  describe('uploadToTmp', () => {
    it('should upload to tmp/ prefix', async () => {
      const file = createFile();
      const result = await mediaService.uploadToTmp(file, ['image/*']);

      expect(result.key).toMatch(/^tmp\/[a-f0-9-]+\.jpg$/);
      expect(result.originalName).toBe('test-file.jpg');
    });

    it('should write the tmp file to disk', async () => {
      const content = Buffer.from('temporary data');
      const file = createFile({ buffer: content, size: content.length });

      const result = await mediaService.uploadToTmp(file, ['image/*']);
      const filePath = join(tmpDir, result.key);
      const written = await readFile(filePath);
      expect(written.toString()).toBe('temporary data');
    });

    it('should reject invalid MIME type in tmp upload', async () => {
      const file = createFile({ mimetype: 'text/plain' });
      await expect(mediaService.uploadToTmp(file, ['image/*'])).rejects.toThrow(
        "File type 'text/plain' is not accepted",
      );
    });

    it('should reject file exceeding custom maxFileSize', async () => {
      const file = createFile({ size: 3 * 1024 * 1024 });
      await expect(
        mediaService.uploadToTmp(file, ['image/*'], 2 * 1024 * 1024),
      ).rejects.toThrow('File size exceeds maximum');
    });
  });

  // ---------- moveFromTmp ----------

  describe('moveFromTmp', () => {
    it('should move tmp file to permanent location', async () => {
      const content = Buffer.from('move me');
      const file = createFile({ buffer: content, size: content.length });

      const tmpFile = await mediaService.uploadToTmp(file, ['image/*']);
      expect(tmpFile.key.startsWith('tmp/')).toBe(true);

      const moved = await mediaService.moveFromTmp(tmpFile, 'users', 'user-1', 'photo');

      expect(moved.key).toMatch(/^users\/user-1\/photo\/[a-f0-9-]+\.jpg$/);
      expect(moved.originalName).toBe('test-file.jpg');
      expect(moved.mimeType).toBe('image/jpeg');
      expect(moved.size).toBe(content.length);

      // Permanent file should exist
      const permanentPath = join(tmpDir, moved.key);
      const written = await readFile(permanentPath);
      expect(written.toString()).toBe('move me');

      // Tmp file should no longer exist
      const tmpPath = join(tmpDir, tmpFile.key);
      await expect(access(tmpPath)).rejects.toThrow();
    });

    it('should return same reference for non-tmp files', async () => {
      const permanentFile: MediaFile = {
        key: 'users/u1/photo/abc.jpg',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        uploadedAt: new Date().toISOString(),
      };

      const result = await mediaService.moveFromTmp(permanentFile, 'users', 'u1', 'photo');
      expect(result).toBe(permanentFile); // exact same reference
    });
  });

  // ---------- move ----------

  describe('move', () => {
    it('should move a file to a new key', async () => {
      const content = Buffer.from('moveable');
      const file = createFile({ buffer: content, size: content.length });
      const config = createFieldConfig();

      const original = await mediaService.upload(file, config);
      const newKey = 'archive/old-file.jpg';

      const moved = await mediaService.move(original, newKey);

      expect(moved.key).toBe(newKey);
      expect(moved.originalName).toBe(original.originalName);
      expect(moved.mimeType).toBe(original.mimeType);
      expect(moved.size).toBe(original.size);

      // New location should have the content
      const movedContent = await readFile(join(tmpDir, newKey));
      expect(movedContent.toString()).toBe('moveable');

      // Old location should not exist
      await expect(access(join(tmpDir, original.key))).rejects.toThrow();
    });
  });

  // ---------- delete ----------

  describe('delete', () => {
    it('should delete a file from disk', async () => {
      const file = createFile();
      const config = createFieldConfig();

      const uploaded = await mediaService.upload(file, config);
      const filePath = join(tmpDir, uploaded.key);
      await access(filePath); // exists

      await mediaService.delete(uploaded.key);
      await expect(access(filePath)).rejects.toThrow();
    });

    it('should not throw when deleting non-existent file', async () => {
      await expect(mediaService.delete('does/not/exist.jpg')).resolves.not.toThrow();
    });
  });

  // ---------- deleteMany ----------

  describe('deleteMany', () => {
    it('should delete multiple files', async () => {
      const config = createFieldConfig();
      const f1 = await mediaService.upload(createFile({ originalname: 'a.jpg' }), config);
      const f2 = await mediaService.upload(createFile({ originalname: 'b.jpg' }), config);

      await access(join(tmpDir, f1.key));
      await access(join(tmpDir, f2.key));

      await mediaService.deleteMany([f1, f2]);

      await expect(access(join(tmpDir, f1.key))).rejects.toThrow();
      await expect(access(join(tmpDir, f2.key))).rejects.toThrow();
    });

    it('should not throw if some files do not exist', async () => {
      const config = createFieldConfig();
      const real = await mediaService.upload(createFile(), config);
      const fake: MediaFile = {
        key: 'fake/missing.jpg',
        originalName: 'missing.jpg',
        mimeType: 'image/jpeg',
        size: 1,
        uploadedAt: '',
      };

      await expect(mediaService.deleteMany([real, fake])).resolves.not.toThrow();
      await expect(access(join(tmpDir, real.key))).rejects.toThrow();
    });
  });

  // ---------- URL generation ----------

  describe('URL generation', () => {
    it('should return correct public URL', () => {
      const url = mediaService.getPublicUrl('users/u1/photo/abc.jpg');
      expect(url).toBe(`${BASE_URL}/users/u1/photo/abc.jpg`);
    });

    it('should return public URL for getSignedUrl (local provider)', async () => {
      const url = await mediaService.getSignedUrl('users/u1/photo/abc.jpg');
      expect(url).toBe(`${BASE_URL}/users/u1/photo/abc.jpg`);
    });
  });

  // ---------- Full lifecycle ----------

  describe('full lifecycle', () => {
    it('should handle upload to tmp → move to permanent → delete', async () => {
      const content = Buffer.from('lifecycle test');
      const file = createFile({ buffer: content, size: content.length });

      // Upload to tmp
      const tmpFile = await mediaService.uploadToTmp(file, ['image/*']);
      expect(tmpFile.key.startsWith('tmp/')).toBe(true);

      const tmpPath = join(tmpDir, tmpFile.key);
      const tmpContent = await readFile(tmpPath);
      expect(tmpContent.toString()).toBe('lifecycle test');

      // Move to permanent
      const permanent = await mediaService.moveFromTmp(tmpFile, 'docs', 'doc-1', 'attachment');
      const permPath = join(tmpDir, permanent.key);
      const permContent = await readFile(permPath);
      expect(permContent.toString()).toBe('lifecycle test');
      await expect(access(tmpPath)).rejects.toThrow();

      // Delete
      await mediaService.delete(permanent.key);
      await expect(access(permPath)).rejects.toThrow();
    });
  });
});
