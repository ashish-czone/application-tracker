import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AttachmentsService } from '../attachments.service';
import { ATTACHMENTS_ATTACHMENT_UPLOADED, ATTACHMENTS_ATTACHMENT_DELETED } from '../../events/types';
import type { AttachmentWithUploader } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: any, data: any) => data),
}));

vi.mock('@packages/media', () => ({
  isMimeTypeAccepted: vi.fn(),
  isFileSizeValid: vi.fn(),
  DEFAULT_MAX_FILE_SIZE: 10 * 1024 * 1024,
}));

import { isMimeTypeAccepted, isFileSizeValid } from '@packages/media';

const mockedIsMimeTypeAccepted = vi.mocked(isMimeTypeAccepted);
const mockedIsFileSizeValid = vi.mocked(isFileSizeValid);

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

describe('AttachmentsService', () => {
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

    // Default: validations pass
    mockedIsMimeTypeAccepted.mockReturnValue(true);
    mockedIsFileSizeValid.mockReturnValue(true);
  });

  // ── upload ───────────────────────────────────────────────────────────

  describe('upload', () => {
    const uploadData = {
      entityType: 'candidates',
      entityId: 'c-1',
      file: {
        buffer: Buffer.from('test'),
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2048,
      },
      uploadedBy: 'user-1',
    };

    it('rejects when MIME type is not accepted', async () => {
      mockedIsMimeTypeAccepted.mockReturnValue(false);

      await expect(service.upload(uploadData as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects with correct message for invalid MIME type', async () => {
      mockedIsMimeTypeAccepted.mockReturnValue(false);

      await expect(service.upload(uploadData as any)).rejects.toThrow('File type "application/pdf" is not accepted');
    });

    it('rejects when file size exceeds maximum', async () => {
      mockedIsFileSizeValid.mockReturnValue(false);

      await expect(service.upload(uploadData as any)).rejects.toThrow(BadRequestException);
    });

    it('uses default acceptedMimeTypes when config not provided', async () => {
      // Setup: make insert return a row so findByIdOrFail works
      const row = buildAttachmentRow();
      mockDb._chain.returning.mockResolvedValueOnce([{ id: 'att-1' }]);
      // findByIdOrFail call after insert
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.upload(uploadData as any);

      expect(mockedIsMimeTypeAccepted).toHaveBeenCalledWith('application/pdf', ['*/*']);
    });

    it('uses custom acceptedMimeTypes from config', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.returning.mockResolvedValueOnce([{ id: 'att-1' }]);
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.upload({
        ...uploadData,
        config: { acceptedMimeTypes: ['image/*'] },
      } as any);

      expect(mockedIsMimeTypeAccepted).toHaveBeenCalledWith('application/pdf', ['image/*']);
    });

    it('uploads file via MediaService on success', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.returning.mockResolvedValueOnce([{ id: 'att-1' }]);
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.upload(uploadData as any);

      expect(mockMediaService.upload).toHaveBeenCalledWith(
        uploadData.file,
        expect.objectContaining({
          entityType: 'candidates',
          entityId: 'c-1',
          fieldName: 'attachments',
        }),
      );
    });

    it('inserts attachment record into database', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.returning.mockResolvedValueOnce([{ id: 'att-1' }]);
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.upload(uploadData as any);

      expect(mockDb.db.insert).toHaveBeenCalled();
      expect(mockDb._chain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'candidates',
          entityId: 'c-1',
          uploadedBy: 'user-1',
          originalName: 'resume.pdf',
          mimeType: 'application/pdf',
          size: 2048,
        }),
      );
    });

    it('emits ATTACHMENTS_ATTACHMENT_UPLOADED event', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.returning.mockResolvedValueOnce([{ id: 'att-1' }]);
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.upload(uploadData as any);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ATTACHMENTS_ATTACHMENT_UPLOADED,
        expect.objectContaining({
          entityType: 'attachments',
          entityId: 'att-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            targetEntityType: 'candidates',
            targetEntityId: 'c-1',
            originalName: 'resume.pdf',
            mimeType: 'application/pdf',
            size: 2048,
          }),
        }),
      );
    });

    it('returns the attachment with uploader info', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.returning.mockResolvedValueOnce([{ id: 'att-1' }]);
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.upload(uploadData as any);

      expect(result).toEqual(buildAttachmentWithUploader());
    });
  });

  // ── findById ─────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns attachment with uploader when found', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('att-1');

      expect(result).toEqual(buildAttachmentWithUploader());
    });

    it('returns null when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('maps uploader fields correctly', async () => {
      const row = buildAttachmentRow({
        uploadedBy: 'user-42',
        uploaderFirstName: 'Alice',
        uploaderLastName: 'Smith',
        uploaderEmail: 'alice@example.com',
      });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('att-1');

      expect(result!.uploader).toEqual({
        id: 'user-42',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
      });
    });
  });

  // ── findByIdOrFail ───────────────────────────────────────────────────

  describe('findByIdOrFail', () => {
    it('returns attachment when found', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findByIdOrFail('att-1');

      expect(result.id).toBe('att-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findByIdOrFail('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws with correct message when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findByIdOrFail('nonexistent')).rejects.toThrow('Attachment not found');
    });
  });

  // ── softDelete ───────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('marks attachment as deleted when called by uploader', async () => {
      const row = buildAttachmentRow({ uploadedBy: 'user-1' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.softDelete('att-1', 'user-1');

      expect(mockDb.db.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedBy: 'user-1',
        }),
      );
    });

    it('throws ForbiddenException when called by non-uploader', async () => {
      const row = buildAttachmentRow({ uploadedBy: 'user-1' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await expect(service.softDelete('att-1', 'user-other')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with correct message for non-uploader', async () => {
      const row = buildAttachmentRow({ uploadedBy: 'user-1' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await expect(service.softDelete('att-1', 'user-other')).rejects.toThrow('Only the uploader can delete this attachment');
    });

    it('throws NotFoundException when attachment does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('emits ATTACHMENTS_ATTACHMENT_DELETED event', async () => {
      const row = buildAttachmentRow({ uploadedBy: 'user-1' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.softDelete('att-1', 'user-1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ATTACHMENTS_ATTACHMENT_DELETED,
        expect.objectContaining({
          entityType: 'attachments',
          entityId: 'att-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            targetEntityType: 'candidates',
            targetEntityId: 'c-1',
            originalName: 'resume.pdf',
          }),
        }),
      );
    });
  });

  // ── hardDelete ───────────────────────────────────────────────────────

  describe('hardDelete', () => {
    it('removes file from storage and deletes DB record', async () => {
      const row = buildAttachmentRow({ uploadedBy: 'user-1' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.hardDelete('att-1', 'user-1');

      expect(mockMediaService.delete).toHaveBeenCalledWith('candidates/c-1/attachments/abc-123.pdf');
      expect(mockDb.db.delete).toHaveBeenCalled();
    });

    it('throws ForbiddenException when called by non-uploader', async () => {
      const row = buildAttachmentRow({ uploadedBy: 'user-1' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await expect(service.hardDelete('att-1', 'user-other')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when attachment does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.hardDelete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('emits ATTACHMENTS_ATTACHMENT_DELETED event', async () => {
      const row = buildAttachmentRow({ uploadedBy: 'user-1' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      await service.hardDelete('att-1', 'user-1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ATTACHMENTS_ATTACHMENT_DELETED,
        expect.objectContaining({
          entityType: 'attachments',
          entityId: 'att-1',
          actorId: 'user-1',
        }),
      );
    });
  });

  // ── deleteByMode ─────────────────────────────────────────────────────

  describe('deleteByMode', () => {
    it('routes to softDelete when mode is soft', async () => {
      const softDeleteSpy = vi.spyOn(service, 'softDelete').mockResolvedValue(undefined);

      await service.deleteByMode('att-1', 'user-1', 'soft');

      expect(softDeleteSpy).toHaveBeenCalledWith('att-1', 'user-1');
    });

    it('routes to hardDelete when mode is hard', async () => {
      const hardDeleteSpy = vi.spyOn(service, 'hardDelete').mockResolvedValue(undefined);

      await service.deleteByMode('att-1', 'user-1', 'hard');

      expect(hardDeleteSpy).toHaveBeenCalledWith('att-1', 'user-1');
    });

    it('defaults to soft delete when no mode provided', async () => {
      const softDeleteSpy = vi.spyOn(service, 'softDelete').mockResolvedValue(undefined);

      await service.deleteByMode('att-1', 'user-1');

      expect(softDeleteSpy).toHaveBeenCalledWith('att-1', 'user-1');
    });
  });

  // ── listForEntity ────────────────────────────────────────────────────

  describe('listForEntity', () => {
    function setupListMocks(rows: any[], total: number) {
      // listForEntity runs two queries in Promise.all:
      //   1) rows:  select().from().innerJoin().where().orderBy().limit().offset()
      //   2) count: select().from().where()
      // We need separate chains because .where() is mid-chain in query 1
      // but terminal in query 2.
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

      // First select() call => rows query, second => count query
      mockDb.db.select
        .mockReturnValueOnce(rowsChain)
        .mockReturnValueOnce(countChain);

      return { rowsChain, countChain };
    }

    it('returns paginated response with data and meta', async () => {
      setupListMocks([buildAttachmentRow()], 1);

      const result = await service.listForEntity('candidates', 'c-1', 1, 25);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(buildAttachmentWithUploader());
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
    });

    it('calculates correct offset for page 2', async () => {
      const { rowsChain } = setupListMocks([], 0);

      await service.listForEntity('candidates', 'c-1', 2, 10);

      expect(rowsChain.offset).toHaveBeenCalledWith(10);
    });

    it('calculates totalPages correctly', async () => {
      setupListMocks([], 51);

      const result = await service.listForEntity('candidates', 'c-1', 1, 25);

      expect(result.meta.totalPages).toBe(3);
    });

    it('returns empty data when no attachments exist', async () => {
      setupListMocks([], 0);

      const result = await service.listForEntity('candidates', 'c-1');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  // ── softDeleteAllForEntity ───────────────────────────────────────────

  describe('softDeleteAllForEntity', () => {
    it('updates all matching attachments with deletedAt and deletedBy', async () => {
      await service.softDeleteAllForEntity('candidates', 'c-1', 'user-1');

      expect(mockDb.db.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedBy: 'user-1',
        }),
      );
    });

    it('uses provided transaction when available', async () => {
      const txChain = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      await service.softDeleteAllForEntity('candidates', 'c-1', 'user-1', txChain);

      expect(txChain.update).toHaveBeenCalled();
      expect(mockDb.db.update).not.toHaveBeenCalled();
    });
  });

  // ── getDownloadUrl ───────────────────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('returns signed URL for existing attachment', async () => {
      const row = buildAttachmentRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.getDownloadUrl('att-1');

      expect(result).toEqual({ url: 'https://storage.example.com/signed-url' });
      expect(mockMediaService.getSignedUrl).toHaveBeenCalledWith('candidates/c-1/attachments/abc-123.pdf');
    });

    it('throws NotFoundException when attachment does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.getDownloadUrl('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
