import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { OrgPositionService } from '../org-position.service';

function createMockChain() {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.orderBy = vi.fn().mockResolvedValue([]);
  chain.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  return chain;
}

function createMockDb() {
  const mockChain = createMockChain();
  const txChain = createMockChain();

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    transaction: vi.fn().mockImplementation(async (cb: any) => cb({
      delete: vi.fn().mockReturnValue(txChain),
      insert: vi.fn().mockReturnValue(txChain),
    })),
    _chain: mockChain,
  };
}

function createMockDatabaseService(mockDb: ReturnType<typeof createMockDb>) {
  return { db: mockDb } as any;
}

describe('OrgPositionService', () => {
  let service: OrgPositionService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = createMockDatabaseService(mockDb);
    service = new OrgPositionService(databaseService);
  });

  describe('create', () => {
    it('should insert a position and return it', async () => {
      const position = { id: 'pos-1', name: 'Team Lead', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([position]);

      const result = await service.create({ name: 'Team Lead' });

      expect(result).toEqual(position);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should accept custom sortOrder', async () => {
      const position = { id: 'pos-1', name: 'Head', sortOrder: 10, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([position]);

      const result = await service.create({ name: 'Head', sortOrder: 10 });

      expect(result.sortOrder).toBe(10);
    });
  });

  describe('findOneOrFail', () => {
    it('should return the position if found', async () => {
      const position = { id: 'pos-1', name: 'Member', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.limit.mockResolvedValueOnce([position]);

      const result = await service.findOneOrFail('pos-1');

      expect(result).toEqual(position);
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findOneOrFail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should throw ConflictException if position is assigned to members', async () => {
      const position = { id: 'pos-1', name: 'Member', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      // findOneOrFail: select→from→where→limit
      mockDb._chain.limit.mockResolvedValueOnce([position]);
      // count: select→from→where (terminal, no limit)
      mockDb._chain.where
        .mockReturnValueOnce(mockDb._chain)     // 1st where (findOneOrFail) → chain for .limit()
        .mockResolvedValueOnce([{ total: 2 }]); // 2nd where (count) → resolves directly

      await expect(service.delete('pos-1')).rejects.toThrow(ConflictException);
    });

    it('should delete position when no members reference it', async () => {
      const position = { id: 'pos-1', name: 'Member', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      // findOneOrFail: select→from→where→limit
      mockDb._chain.limit.mockResolvedValueOnce([position]);
      // count: select→from→where (terminal, no limit)
      mockDb._chain.where
        .mockReturnValueOnce(mockDb._chain)     // 1st where (findOneOrFail) → chain for .limit()
        .mockResolvedValueOnce([{ total: 0 }]); // 2nd where (count) → resolves directly

      await service.delete('pos-1');

      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return all positions ordered by sortOrder', async () => {
      const positions = [
        { id: 'pos-1', name: 'Head', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: 'pos-2', name: 'Lead', sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      ];
      mockDb._chain.orderBy.mockResolvedValueOnce(positions);

      const result = await service.findAll();

      expect(result).toEqual(positions);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });

    it('should return empty array when no positions exist', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update and return the position', async () => {
      const position = { id: 'pos-1', name: 'Head', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      const updated = { ...position, name: 'Senior Lead' };
      // findOneOrFail
      mockDb._chain.limit.mockResolvedValueOnce([position]);
      // update returning
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const result = await service.update('pos-1', { name: 'Senior Lead' });

      expect(result.name).toBe('Senior Lead');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if position not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.update('nonexistent', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('should update sortOrder', async () => {
      const position = { id: 'pos-1', name: 'Head', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      const updated = { ...position, sortOrder: 5 };
      mockDb._chain.limit.mockResolvedValueOnce([position]);
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const result = await service.update('pos-1', { sortOrder: 5 });

      expect(result.sortOrder).toBe(5);
      expect(mockDb._chain.set).toHaveBeenCalledWith({ sortOrder: 5 });
    });
  });

  describe('seedDefaults', () => {
    it('should insert default positions when none exist', async () => {
      // existing check: select→from→limit returns empty
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await service.seedDefaults();

      // 3 default positions: Head, Lead, Member
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it('should skip seeding when positions already exist', async () => {
      // existing check: select→from→limit returns a row
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'pos-existing' }]);

      await service.seedDefaults();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

});
