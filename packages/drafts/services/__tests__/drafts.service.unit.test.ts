import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DraftsService } from '../drafts.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

describe('DraftsService', () => {
  let service: DraftsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    service = new DraftsService(databaseService);
  });

  describe('save', () => {
    it('should create a new draft when none exists', async () => {
      const draft = {
        id: 'd1',
        entityType: 'evaluations',
        draftKey: 'eval-interview-123',
        data: { overallRating: 4 },
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // find returns nothing (no existing draft)
      mockDb._chain.limit.mockResolvedValueOnce([]);
      // insert returns new draft
      mockDb._chain.returning.mockResolvedValueOnce([draft]);

      const result = await service.save({
        entityType: 'evaluations',
        draftKey: 'eval-interview-123',
        data: { overallRating: 4 },
        createdById: 'user-1',
      });

      expect(result).toEqual(draft);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should update an existing draft', async () => {
      const existing = {
        id: 'd1',
        entityType: 'evaluations',
        draftKey: 'eval-interview-123',
        data: { overallRating: 3 },
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updated = { ...existing, data: { overallRating: 5 } };

      // find returns existing draft
      mockDb._chain.limit.mockResolvedValueOnce([existing]);
      // update returns updated draft
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const result = await service.save({
        entityType: 'evaluations',
        draftKey: 'eval-interview-123',
        data: { overallRating: 5 },
        createdById: 'user-1',
      });

      expect(result.data).toEqual({ overallRating: 5 });
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('find', () => {
    it('should return a draft when found', async () => {
      const draft = {
        id: 'd1',
        entityType: 'evaluations',
        draftKey: 'eval-interview-123',
        data: { overallRating: 4 },
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb._chain.limit.mockResolvedValueOnce([draft]);

      const result = await service.find('evaluations', 'eval-interview-123', 'user-1');
      expect(result).toEqual(draft);
    });

    it('should return null when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.find('evaluations', 'nonexistent', 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a draft', async () => {
      await service.delete('evaluations', 'eval-interview-123', 'user-1');
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('should list all drafts for a user', async () => {
      const drafts = [
        { id: 'd1', entityType: 'evaluations', draftKey: 'k1', data: {}, createdById: 'user-1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'd2', entityType: 'notes', draftKey: 'k2', data: {}, createdById: 'user-1', createdAt: new Date(), updatedAt: new Date() },
      ];

      mockDb._chain.where.mockResolvedValueOnce(drafts);

      const result = await service.listForUser('user-1');
      expect(result).toHaveLength(2);
    });
  });
});
