import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AttachmentsService } from '../attachments.service';
import type { AttachmentWithUploader } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: any, data: any) => data),
}));

vi.mock('@packages/media', () => ({
  isMimeTypeAccepted: vi.fn().mockReturnValue(true),
  isFileSizeValid: vi.fn().mockReturnValue(true),
  DEFAULT_MAX_FILE_SIZE: 10 * 1024 * 1024,
}));

// --- Mock helpers ---

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  };
  return {
    db: {
      select: vi.fn().mockReturnValue(mockChain),
      insert: vi.fn().mockReturnValue(mockChain),
      update: vi.fn().mockReturnValue(mockChain),
      delete: vi.fn().mockReturnValue(mockChain),
    },
    _chain: mockChain,
  };
}

function createMockMediaService() {
  return {
    upload: vi.fn().mockResolvedValue({
      key: 'candidates/c-1/attachments/abc-123.pdf',
      originalName: 'resume.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      uploadedAt: '2026-01-01T00:00:00.000Z',
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue('https://storage.example.com/signed-url'),
  };
}

function createMockEventEmitter() {
  return {
    emit: vi.fn(),
  };
}

function buildAttachmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1',
    entityType: 'candidates',
    entityId: 'c-1',
    fileKey: 'candidates/c-1/attachments/abc-123.pdf',
    originalName: 'resume.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    uploadedBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    deletedAt: null,
    deletedBy: null,
    uploaderFirstName: 'Jane',
    uploaderLastName: 'Doe',
    uploaderEmail: 'jane@example.com',
    ...overrides,
  };
}

function buildAttachmentWithUploader(overrides: Partial<AttachmentWithUploader> = {}): AttachmentWithUploader {
  return {
    id: 'att-1',
    entityType: 'candidates',
    entityId: 'c-1',
    fileKey: 'candidates/c-1/attachments/abc-123.pdf',
    originalName: 'resume.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    uploadedBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    deletedAt: null,
    deletedBy: null,
    uploader: {
      id: 'user-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    },
    ...overrides,
  };
}

// --- Tests ---

describe('AttachmentsService – additional coverage', () => {
  let service: AttachmentsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockMediaService: ReturnType<typeof createMockMediaService>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockMediaService = createMockMediaService();
    mockEventEmitter = createMockEventEmitter();
    service = new AttachmentsService(
      mockDb as any,
      mockMediaService as any,
      mockEventEmitter as any,
    );
  });

  // ──────────────────────────────────────────────────────────
  // listForEntity() – deeper coverage
  // ──────────────────────────────────────────────────────────

  describe('listForEntity', () => {
    function setupListMocks(rows: any[], total: number) {
      const rowsChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(rows),
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total }]),
      };

      mockDb.db.select
        .mockReturnValueOnce(rowsChain)
        .mockReturnValueOnce(countChain);

      return { rowsChain, countChain };
    }

    it('should use default page=1 and limit=25 when not specified', async () => {
      const { rowsChain } = setupListMocks([], 0);

      const result = await service.listForEntity('candidates', 'c-1');

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
      expect(rowsChain.offset).toHaveBeenCalledWith(0);
    });

    it('should map multiple rows through toAttachmentWithUploader', async () => {
      const row1 = buildAttachmentRow({ id: 'att-1', originalName: 'resume.pdf' });
      const row2 = buildAttachmentRow({ id: 'att-2', originalName: 'cover.pdf', uploadedBy: 'user-2', uploaderFirstName: 'John', uploaderLastName: 'Doe', uploaderEmail: 'john@example.com' });
      setupListMocks([row1, row2], 2);

      const result = await service.listForEntity('candidates', 'c-1');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].originalName).toBe('resume.pdf');
      expect(result.data[0].uploader.firstName).toBe('Jane');
      expect(result.data[1].originalName).toBe('cover.pdf');
      expect(result.data[1].uploader.firstName).toBe('John');
    });

    it('should calculate offset for page 3 with limit 5', async () => {
      const { rowsChain } = setupListMocks([], 0);

      await service.listForEntity('candidates', 'c-1', 3, 5);

      expect(rowsChain.offset).toHaveBeenCalledWith(10); // (3-1)*5
    });

    it('should handle totalPages when total is not a multiple of limit', async () => {
      setupListMocks([], 7);

      const result = await service.listForEntity('candidates', 'c-1', 1, 3);

      expect(result.meta.totalPages).toBe(3); // ceil(7/3)
    });

    it('should return correct meta for a single-page result', async () => {
      setupListMocks([buildAttachmentRow()], 1);

      const result = await service.listForEntity('candidates', 'c-1', 1, 25);

      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // getDownloadUrl() – deeper coverage
  // ──────────────────────────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('should call mediaService.getSignedUrl with the attachment fileKey', async () => {
      const row = buildAttachmentRow({ fileKey: 'docs/file-key-xyz.pdf' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.getDownloadUrl('att-1');

      expect(mockMediaService.getSignedUrl).toHaveBeenCalledWith('docs/file-key-xyz.pdf');
    });

    it('should return the signed URL in an object', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);
      mockMediaService.getSignedUrl.mockResolvedValueOnce('https://cdn.example.com/presigned');

      const result = await service.getDownloadUrl('att-1');

      expect(result).toEqual({ url: 'https://cdn.example.com/presigned' });
    });

    it('should throw NotFoundException when attachment does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.getDownloadUrl('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw with correct message when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.getDownloadUrl('nonexistent'))
        .rejects.toThrow('Attachment not found');
    });

    it('should propagate errors from mediaService.getSignedUrl', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);
      mockMediaService.getSignedUrl.mockRejectedValueOnce(new Error('Storage unavailable'));

      await expect(service.getDownloadUrl('att-1'))
        .rejects.toThrow('Storage unavailable');
    });
  });
});
