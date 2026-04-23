import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PositionScopeResolverService } from '../position-scope-resolver.service';

function createMockChain() {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.orderBy = vi.fn().mockResolvedValue([]);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  return chain;
}

function createMockDb() {
  const mockChain = createMockChain();

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    _chain: mockChain,
  };
}

function createMockDatabaseService(mockDb: ReturnType<typeof createMockDb>) {
  return { db: mockDb } as any;
}

describe('PositionScopeResolverService', () => {
  let service: PositionScopeResolverService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = createMockDatabaseService(mockDb);
    service = new PositionScopeResolverService(databaseService);
  });

  describe('resolveUserIds', () => {
    it('should return null for non-hierarchical scopes', async () => {
      expect(await service.resolveUserIds('user-1', 'own')).toBeNull();
      expect(await service.resolveUserIds('user-1', 'assigned')).toBeNull();
      expect(await service.resolveUserIds('user-1', 'any')).toBeNull();
      expect(await service.resolveUserIds('user-1', 'hiring-manager')).toBeNull();
    });

    it('should expand descendants for "descendants" scope', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { user_id: 'user-1' },
          { user_id: 'user-2' },
          { user_id: 'user-3' },
        ],
      });

      const result = await service.resolveUserIds('user-1', 'descendants');

      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
      expect(result).toContain('user-3');
      expect(result).toHaveLength(3);
    });

    it('should always include the user themselves in descendants', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ user_id: 'user-2' }],
      });

      const result = await service.resolveUserIds('user-1', 'descendants');

      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
    });

    it('should expand unit members for "unit" scope', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { orgUnitId: 'unit-1' },
      ]);
      mockDb._chain.where.mockResolvedValueOnce([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const result = await service.resolveUserIds('user-1', 'unit');

      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
      expect(result).toHaveLength(2);
    });

    it('should return [userId] for "unit" scope when user has no org units', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.resolveUserIds('user-1', 'unit');

      expect(result).toEqual(['user-1']);
    });
  });

  describe('resolveOrgUnitIds', () => {
    it('should return null for non-hierarchical scopes', async () => {
      expect(await service.resolveOrgUnitIds('user-1', 'own')).toBeNull();
      expect(await service.resolveOrgUnitIds('user-1', 'assigned')).toBeNull();
      expect(await service.resolveOrgUnitIds('user-1', 'any')).toBeNull();
      expect(await service.resolveOrgUnitIds('user-1', 'hiring-manager')).toBeNull();
    });

    it('should expand descendant org unit IDs for "descendants" scope', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { id: 'unit-1' },
          { id: 'unit-2' },
          { id: 'unit-3' },
        ],
      });

      const result = await service.resolveOrgUnitIds('user-1', 'descendants');

      expect(result).toContain('unit-1');
      expect(result).toContain('unit-2');
      expect(result).toContain('unit-3');
      expect(result).toHaveLength(3);
    });

    it('should return direct org unit IDs for "unit" scope', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { orgUnitId: 'unit-1' },
        { orgUnitId: 'unit-2' },
      ]);

      const result = await service.resolveOrgUnitIds('user-1', 'unit');

      expect(result).toEqual(['unit-1', 'unit-2']);
    });

    it('should return empty array for "unit" scope when user has no org units', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.resolveOrgUnitIds('user-1', 'unit');

      expect(result).toEqual([]);
    });
  });
});
