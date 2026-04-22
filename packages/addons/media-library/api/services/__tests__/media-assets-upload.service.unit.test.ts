import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaAssetsUploadService } from '../media-assets-upload.service';

// Smallest valid 2x2 PNG — a transparent stripe. Lets sharp parse
// width/height without pulling a fixture file into the repo.
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000020000000208060000' +
  '00727b3abc0000000c49444154789c636060000000050001a5f645d30' +
  '000000049454e44ae426082',
  'hex',
);

function makeDeps(overrides: {
  insertError?: Error;
} = {}) {
  const mediaFile = {
    key: 'media-assets/abc/file/tiny.png',
    originalName: 'tiny.png',
    mimeType: 'image/png',
    size: TINY_PNG.length,
    uploadedAt: new Date().toISOString(),
  };

  const mediaService = {
    upload: vi.fn().mockResolvedValue(mediaFile),
    getPublicUrl: vi.fn((key: string) => `http://localhost/uploads/${key}`),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const returningMock = vi.fn().mockImplementation(() =>
    overrides.insertError
      ? Promise.reject(overrides.insertError)
      : Promise.resolve([
          {
            id: 'asset-id',
            storageKey: mediaFile.key,
            url: `http://localhost/uploads/${mediaFile.key}`,
            originalName: mediaFile.originalName,
            mimeType: mediaFile.mimeType,
            size: mediaFile.size,
            width: 2,
            height: 2,
            altText: null,
            caption: null,
            createdBy: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
  );

  const db = {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: returningMock })),
      })),
    },
  };

  const logger = {
    forContext: vi.fn(() => ({
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };

  return { mediaService, db, logger, mediaFile };
}

describe('MediaAssetsUploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads, extracts PNG dimensions, and returns the asset row', async () => {
    const { mediaService, db, logger } = makeDeps();
    const service = new MediaAssetsUploadService(
      mediaService as never,
      db as never,
      logger as never,
    );

    const result = await service.upload({
      file: {
        buffer: TINY_PNG,
        originalname: 'tiny.png',
        mimetype: 'image/png',
        size: TINY_PNG.length,
      },
      altText: 'Tiny placeholder',
      createdBy: 'user-1',
    });

    expect(mediaService.upload).toHaveBeenCalledTimes(1);
    expect(mediaService.upload.mock.calls[0][1]).toMatchObject({
      entityType: 'media-assets',
      fieldName: 'file',
      maxFiles: 1,
      accept: expect.arrayContaining(['image/png', 'image/jpeg']),
    });
    expect(result).toMatchObject({
      id: 'asset-id',
      storageKey: 'media-assets/abc/file/tiny.png',
      url: 'http://localhost/uploads/media-assets/abc/file/tiny.png',
      width: 2,
      height: 2,
    });
    expect(mediaService.delete).not.toHaveBeenCalled();
  });

  it('cleans up the uploaded file when the DB insert fails', async () => {
    const { mediaService, db, logger, mediaFile } = makeDeps({
      insertError: new Error('db down'),
    });
    const service = new MediaAssetsUploadService(
      mediaService as never,
      db as never,
      logger as never,
    );

    await expect(
      service.upload({
        file: {
          buffer: TINY_PNG,
          originalname: 'tiny.png',
          mimetype: 'image/png',
          size: TINY_PNG.length,
        },
        createdBy: 'user-1',
      }),
    ).rejects.toThrow('db down');

    expect(mediaService.delete).toHaveBeenCalledWith(mediaFile.key);
  });

  it('returns null dimensions for SVG uploads (sharp is unreliable on SVG)', async () => {
    const { mediaService, db, logger } = makeDeps();
    mediaService.upload.mockResolvedValueOnce({
      key: 'media-assets/abc/file/logo.svg',
      originalName: 'logo.svg',
      mimeType: 'image/svg+xml',
      size: 100,
      uploadedAt: new Date().toISOString(),
    });

    const service = new MediaAssetsUploadService(
      mediaService as never,
      db as never,
      logger as never,
    );

    await service.upload({
      file: {
        buffer: Buffer.from('<svg/>'),
        originalname: 'logo.svg',
        mimetype: 'image/svg+xml',
        size: 6,
      },
      createdBy: 'user-1',
    });

    const insertCall = (db.db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;
    const valuesArg = (insertCall.values as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(valuesArg.width).toBeNull();
    expect(valuesArg.height).toBeNull();
  });

  describe('validateFile', () => {
    it('throws when no file is provided', () => {
      expect(() => MediaAssetsUploadService.validateFile(undefined)).toThrow(
        'No file provided',
      );
    });

    it('accepts a well-formed file', () => {
      expect(() =>
        MediaAssetsUploadService.validateFile({
          buffer: Buffer.from(''),
          originalname: 'x.png',
          mimetype: 'image/png',
          size: 0,
        }),
      ).not.toThrow();
    });
  });
});
