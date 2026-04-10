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

  describe('resolveScope', () => {
    it('should return "own" when user has no position scopes', async () => {
      // select→from→innerJoin→where returns empty array
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.resolveScope('user-1', 'candidates');

      expect(result).toBe('own');
    });

    it('should return the scope when user has a single position', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ scope: 'descendants' }]);

      const result = await service.resolveScope('user-1', 'candidates');

      expect(result).toBe('descendants');
    });

    it('should return the most permissive scope when user has multiple positions', async () => {
      // User is in two org units with different positions/scopes for candidates
      mockDb._chain.where.mockResolvedValueOnce([
        { scope: 'unit' },        // rank 2
        { scope: 'descendants' }, // rank 3 — this should win
      ]);

      const result = await service.resolveScope('user-1', 'candidates');

      expect(result).toBe('descendants');
    });

    it('should return "all" when any position grants "all"', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { scope: 'unit' },
        { scope: 'all' },
        { scope: 'own' },
      ]);

      const result = await service.resolveScope('user-1', 'candidates');

      expect(result).toBe('all');
    });

    it('should handle custom scope keys with rank equivalent to "own"', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { scope: 'hiring-manager' }, // custom, rank 1 (same as own)
        { scope: 'unit' },           // rank 2 — this wins
      ]);

      const result = await service.resolveScope('user-1', 'job-openings');

      expect(result).toBe('unit');
    });

    it('should return custom scope when it is the only scope', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { scope: 'hiring-manager' },
      ]);

      const result = await service.resolveScope('user-1', 'job-openings');

      expect(result).toBe('hiring-manager');
    });
  });

  describe('resolveUserIds', () => {
    it('should return null for "all" scope', async () => {
      const result = await service.resolveUserIds('user-1', 'all');

      expect(result).toBeNull();
    });

    it('should return [userId] for "own" scope', async () => {
      const result = await service.resolveUserIds('user-1', 'own');

      expect(result).toEqual(['user-1']);
    });

    it('should return null for custom scopes (delegated to entity engine)', async () => {
      const result = await service.resolveUserIds('user-1', 'hiring-manager');

      expect(result).toBeNull();
    });

    it('should expand descendants for "descendants" scope', async () => {
      // execute returns recursive CTE result
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
      // Even if the CTE doesn't include them
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ user_id: 'user-2' }],
      });

      const result = await service.resolveUserIds('user-1', 'descendants');

      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
    });

    it('should expand unit members for "unit" scope', async () => {
      // First query: get user's org unit IDs
      mockDb._chain.where.mockResolvedValueOnce([
        { orgUnitId: 'unit-1' },
      ]);
      // Second query: get all members in those org units
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
});
