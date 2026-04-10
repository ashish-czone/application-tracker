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

    it('should delete position and its scopes when no members reference it', async () => {
      const position = { id: 'pos-1', name: 'Member', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      // findOneOrFail: select→from→where→limit
      mockDb._chain.limit.mockResolvedValueOnce([position]);
      // count: select→from→where (terminal, no limit)
      mockDb._chain.where
        .mockReturnValueOnce(mockDb._chain)     // 1st where (findOneOrFail) → chain for .limit()
        .mockResolvedValueOnce([{ total: 0 }]); // 2nd where (count) → resolves directly

      await service.delete('pos-1');

      // Two deletes: scopes first, then position
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('setScopes', () => {
    it('should replace all scopes for a position', async () => {
      const position = { id: 'pos-1', name: 'Manager', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };

      const scopes = [
        { entityType: 'candidates', scope: 'descendants' },
        { entityType: 'job-openings', scope: 'unit' },
      ];

      // findOneOrFail for setScopes + findOneOrFail for getScopes
      mockDb._chain.limit
        .mockResolvedValueOnce([position])
        .mockResolvedValueOnce([position]);

      // getScopes: select→from→where (terminal)
      mockDb._chain.where
        .mockReturnValueOnce(mockDb._chain)  // 1st where (findOneOrFail in setScopes)
        .mockReturnValueOnce(mockDb._chain)  // 2nd where (findOneOrFail in getScopes)
        .mockResolvedValueOnce(scopes.map((s) => ({ positionId: 'pos-1', ...s }))); // 3rd where (getScopes query)

      const result = await service.setScopes('pos-1', scopes);

      expect(result).toHaveLength(2);
      expect(mockDb.transaction).toHaveBeenCalled();
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

  describe('getScopes', () => {
    it('should return scopes for the position', async () => {
      const position = { id: 'pos-1', name: 'Manager', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      const scopes = [
        { positionId: 'pos-1', entityType: 'candidates', scope: 'descendants' },
        { positionId: 'pos-1', entityType: 'job-openings', scope: 'all' },
      ];
      // findOneOrFail
      mockDb._chain.limit.mockResolvedValueOnce([position]);
      // getScopes query: select→from→where (terminal)
      mockDb._chain.where
        .mockReturnValueOnce(mockDb._chain)  // findOneOrFail where → chain for .limit()
        .mockResolvedValueOnce(scopes);       // getScopes where → resolves directly

      const result = await service.getScopes('pos-1');

      expect(result).toHaveLength(2);
      expect(result[0].entityType).toBe('candidates');
    });

    it('should return empty array when no scopes configured', async () => {
      const position = { id: 'pos-1', name: 'Member', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.limit.mockResolvedValueOnce([position]);
      mockDb._chain.where
        .mockReturnValueOnce(mockDb._chain)
        .mockResolvedValueOnce([]);

      const result = await service.getScopes('pos-1');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException if position not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.getScopes('nonexistent')).rejects.toThrow(NotFoundException);
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

  describe('getScopeForEntity', () => {
    it('should return scope when configured', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ scope: 'descendants' }]);

      const result = await service.getScopeForEntity('pos-1', 'candidates');

      expect(result).toBe('descendants');
    });

    it('should return null when no scope configured', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.getScopeForEntity('pos-1', 'unknown-entity');

      expect(result).toBeNull();
    });
  });
});
