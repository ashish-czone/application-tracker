import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { HierarchyService } from '../hierarchy.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
}));

// ── Mock DB builder ───────────────────────────────────────────────────

/**
 * Drizzle query builders are both thenable (can be awaited directly) and
 * chainable (support further method calls like .orderBy() after .where()).
 * This helper creates a thenable with optional extra chain methods.
 */
function createThenable(resolveValue: any, extra: Record<string, any> = {}) {
  return {
    then: (resolve: any, reject?: any) => Promise.resolve(resolveValue).then(resolve, reject),
    ...extra,
  };
}

function createMockDb() {
  // Sequential results for db.where() calls. Each call pops the next value.
  let dbWhereQueue: any[] = [];

  const orderByFn = vi.fn();

  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      const val = dbWhereQueue.shift() ?? [];
      // Return a thenable that also supports .orderBy() chaining
      orderByFn.mockReturnValue(Promise.resolve(val));
      return createThenable(val, { orderBy: orderByFn });
    }),
    orderBy: orderByFn,
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  const txChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  (chain as any).transaction = vi.fn().mockImplementation(async (cb: any) => cb(txChain));

  return {
    db: chain as any,
    tx: txChain,
    /** Queue sequential return values for db.where() / db.where().orderBy() calls */
    queueWhereResults(...results: any[]) {
      dbWhereQueue = [...results];
    },
  };
}

// ── Mock table + column references ────────────────────────────────────

const mockTable = {} as any;
const mockIdCol = {} as any;
const mockParentIdCol = {} as any;
const mockPathCol = {} as any;
const mockDepthCol = {} as any;

// ── Test suite ────────────────────────────────────────────────────────

describe('HierarchyService', () => {
  let service: HierarchyService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new HierarchyService({ db: mockDb.db } as any);
  });

  // ── computeInsertValues ─────────────────────────────────────────────

  describe('computeInsertValues', () => {
    it('returns path and depth 0 for a root node (null parent)', () => {
      const result = service.computeInsertValues(null, 'node-1');

      expect(result).toEqual({ path: '/node-1', depth: 0 });
    });

    it('returns path and depth 1 for a direct child', () => {
      const result = service.computeInsertValues('/parent', 'child');

      expect(result).toEqual({ path: '/parent/child', depth: 1 });
    });

    it('returns correct path and depth for a deeply nested node', () => {
      const result = service.computeInsertValues('/a/b/c', 'd');

      expect(result).toEqual({ path: '/a/b/c/d', depth: 3 });
    });

    it('returns path and depth 0 when parent path is slash-only', () => {
      const result = service.computeInsertValues('/' as any, 'root-child');

      // computePath treats "/" as root
      expect(result).toEqual({ path: '/root-child', depth: 0 });
    });
  });

  // ── getAncestors ───────────────────────────────────────────────────

  describe('getAncestors', () => {
    it('returns empty array for a root node (no ancestors)', async () => {
      const result = await service.getAncestors(mockTable, mockIdCol, mockPathCol, '/root-node');

      expect(result).toEqual([]);
      // Should short-circuit before querying the DB
      expect(mockDb.db.select).not.toHaveBeenCalled();
    });

    it('queries DB with ancestor IDs and returns rows ordered by path', async () => {
      const parentRow = { id: 'parent', path: '/parent', depth: 0 };
      mockDb.queueWhereResults([parentRow]);

      const result = await service.getAncestors(
        mockTable,
        mockIdCol,
        mockPathCol,
        '/parent/child',
      );

      expect(result).toEqual([parentRow]);
      expect(mockDb.db.select).toHaveBeenCalled();
      expect(mockDb.db.from).toHaveBeenCalledWith(mockTable);
    });

    it('returns all ancestors for a deeply nested node', async () => {
      const ancestors = [
        { id: 'a', path: '/a', depth: 0 },
        { id: 'b', path: '/a/b', depth: 1 },
        { id: 'c', path: '/a/b/c', depth: 2 },
      ];
      mockDb.queueWhereResults(ancestors);

      const result = await service.getAncestors(
        mockTable,
        mockIdCol,
        mockPathCol,
        '/a/b/c/d',
      );

      expect(result).toEqual(ancestors);
      expect(result).toHaveLength(3);
    });

    it('calls orderBy to sort ancestors from root to parent', async () => {
      mockDb.queueWhereResults([]);

      await service.getAncestors(mockTable, mockIdCol, mockPathCol, '/x/y/z');

      expect(mockDb.db.orderBy).toHaveBeenCalled();
    });
  });

  // ── getDescendants ─────────────────────────────────────────────────

  describe('getDescendants', () => {
    it('returns descendant rows from DB', async () => {
      const descendants = [
        { id: 'child', path: '/parent/child', depth: 1 },
        { id: 'grandchild', path: '/parent/child/grandchild', depth: 2 },
      ];
      mockDb.queueWhereResults(descendants);

      const result = await service.getDescendants(mockTable, mockPathCol, '/parent');

      expect(result).toEqual(descendants);
      expect(mockDb.db.select).toHaveBeenCalled();
      expect(mockDb.db.from).toHaveBeenCalledWith(mockTable);
    });

    it('returns empty array when no descendants exist', async () => {
      mockDb.queueWhereResults([]);

      const result = await service.getDescendants(mockTable, mockPathCol, '/leaf-node');

      expect(result).toEqual([]);
    });

    it('queries using the descendant prefix pattern', async () => {
      mockDb.queueWhereResults([]);

      await service.getDescendants(mockTable, mockPathCol, '/a/b');

      expect(mockDb.db.where).toHaveBeenCalled();
    });
  });

  // ── move ───────────────────────────────────────────────────────────

  describe('move', () => {
    it('throws ConflictException when moving a node to itself (self-parenting)', async () => {
      await expect(
        service.move(
          mockTable,
          mockIdCol,
          mockParentIdCol,
          mockPathCol,
          mockDepthCol,
          'node-1',
          '/node-1',
          'node-1', // same as nodeId
          '/node-1',
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.move(
          mockTable,
          mockIdCol,
          mockParentIdCol,
          mockPathCol,
          mockDepthCol,
          'node-1',
          '/node-1',
          'node-1',
          '/node-1',
        ),
      ).rejects.toThrow('A node cannot be its own parent');
    });

    it('throws ConflictException when moving a node under its own descendant (cycle)', async () => {
      // node-1 has path /node-1, trying to move under /node-1/child (which is a descendant)
      await expect(
        service.move(
          mockTable,
          mockIdCol,
          mockParentIdCol,
          mockPathCol,
          mockDepthCol,
          'node-1',
          '/node-1',
          'child',
          '/node-1/child', // descendant of /node-1
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.move(
          mockTable,
          mockIdCol,
          mockParentIdCol,
          mockPathCol,
          mockDepthCol,
          'node-1',
          '/node-1',
          'grandchild',
          '/node-1/child/grandchild',
        ),
      ).rejects.toThrow('Moving this node would create a cycle');
    });

    it('does not throw cycle error when newParentId is null (moving to root)', async () => {
      // Moving to root: newParentId = null, newParentPath = null
      mockDb.tx.where.mockResolvedValue([]); // no descendants

      await expect(
        service.move(
          mockTable,
          mockIdCol,
          mockParentIdCol,
          mockPathCol,
          mockDepthCol,
          'child',
          '/parent/child',
          null,
          null,
        ),
      ).resolves.not.toThrow();
    });

    it('updates the moved node with new parentId, path, and depth', async () => {
      // Moving /a/b to become child of /x -> new path = /x/b, depth = 1
      mockDb.tx.where.mockResolvedValue([]); // no descendants

      await service.move(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
        'b',
        '/a/b',
        'x',
        '/x',
      );

      expect(mockDb.db.transaction).toHaveBeenCalled();
      expect(mockDb.tx.update).toHaveBeenCalledWith(mockTable);
      expect(mockDb.tx.set).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'x',
          path: '/x/b',
          depth: 1,
        }),
      );
    });

    it('moves a node to root (null parent) with correct path and depth', async () => {
      mockDb.tx.where.mockResolvedValue([]); // no descendants

      await service.move(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
        'child',
        '/parent/child',
        null,
        null,
      );

      expect(mockDb.tx.set).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: null,
          path: '/child',
          depth: 0,
        }),
      );
    });

    it('updates all descendant paths when moving a node with subtree', async () => {
      const descendants = [
        { id: 'c', path: '/a/b/c' },
        { id: 'd', path: '/a/b/c/d' },
      ];

      // First tx.where call: update().set().where() for the node itself -> returns undefined
      // Second tx.where call: select().from().where() for descendants -> returns the list
      // Third + fourth: update().set().where() for each descendant -> returns undefined
      let whereCallCount = 0;
      mockDb.tx.where.mockImplementation(async () => {
        whereCallCount++;
        // Call 2 is the descendant select
        if (whereCallCount === 2) return descendants;
        return undefined;
      });

      await service.move(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
        'b',
        '/a/b',
        'x',
        '/x',
      );

      // 1 update for the node + 2 updates for descendants = 3 total
      expect(mockDb.tx.update).toHaveBeenCalledTimes(3);
    });

    it('rebases descendant paths from old prefix to new prefix', async () => {
      const descendants = [{ id: 'c', path: '/a/b/c' }];

      let whereCallCount = 0;
      mockDb.tx.where.mockImplementation(async () => {
        whereCallCount++;
        if (whereCallCount === 2) return descendants;
        return undefined;
      });

      await service.move(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
        'b',
        '/a/b',
        'x',
        '/x',
      );

      const setCalls = mockDb.tx.set.mock.calls;
      // First call: node itself { parentId: 'x', path: '/x/b', depth: 1 }
      expect(setCalls[0][0]).toEqual({
        parentId: 'x',
        path: '/x/b',
        depth: 1,
      });
      // Second call: descendant c rebased from /a/b/c -> /x/b/c
      expect(setCalls[1][0]).toEqual({ path: '/x/b/c', depth: 2 });
    });

    it('wraps the entire move in a transaction', async () => {
      mockDb.tx.where.mockResolvedValue([]); // no descendants

      await service.move(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
        'b',
        '/a/b',
        'x',
        '/x',
      );

      expect(mockDb.db.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.db.transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('does not open a transaction if self-parenting is detected', async () => {
      await expect(
        service.move(
          mockTable,
          mockIdCol,
          mockParentIdCol,
          mockPathCol,
          mockDepthCol,
          'node-1',
          '/node-1',
          'node-1',
          '/node-1',
        ),
      ).rejects.toThrow();

      expect(mockDb.db.transaction).not.toHaveBeenCalled();
    });

    it('does not open a transaction if cycle is detected', async () => {
      await expect(
        service.move(
          mockTable,
          mockIdCol,
          mockParentIdCol,
          mockPathCol,
          mockDepthCol,
          'a',
          '/a',
          'b',
          '/a/b',
        ),
      ).rejects.toThrow();

      expect(mockDb.db.transaction).not.toHaveBeenCalled();
    });
  });

  // ── backfillPaths ──────────────────────────────────────────────────

  describe('backfillPaths', () => {
    it('returns 0 for an empty table', async () => {
      mockDb.queueWhereResults([]);

      const count = await service.backfillPaths(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
      );

      expect(count).toBe(0);
      expect(mockDb.db.select).toHaveBeenCalled();
      expect(mockDb.db.update).not.toHaveBeenCalled();
    });

    it('computes path and depth for a single root node', async () => {
      const rows = [{ id: 'root', parentId: null }];
      // First where: select all rows; second where: update().set().where()
      mockDb.queueWhereResults(rows, undefined);

      const count = await service.backfillPaths(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
      );

      expect(count).toBe(1);
      expect(mockDb.db.set).toHaveBeenCalledWith({ path: '/root', depth: 0 });
    });

    it('computes correct paths for a parent-child tree', async () => {
      const rows = [
        { id: 'parent', parentId: null },
        { id: 'child', parentId: 'parent' },
      ];
      mockDb.queueWhereResults(rows, undefined, undefined);

      const count = await service.backfillPaths(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
      );

      expect(count).toBe(2);

      const setCalls = mockDb.db.set.mock.calls;
      expect(setCalls[0][0]).toEqual({ path: '/parent', depth: 0 });
      expect(setCalls[1][0]).toEqual({ path: '/parent/child', depth: 1 });
    });

    it('computes correct paths for multiple independent roots', async () => {
      const rows = [
        { id: 'root-a', parentId: null },
        { id: 'root-b', parentId: null },
      ];
      mockDb.queueWhereResults(rows, undefined, undefined);

      const count = await service.backfillPaths(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
      );

      expect(count).toBe(2);

      const setCalls = mockDb.db.set.mock.calls;
      expect(setCalls[0][0]).toEqual({ path: '/root-a', depth: 0 });
      expect(setCalls[1][0]).toEqual({ path: '/root-b', depth: 0 });
    });

    it('walks the full parent chain for deeply nested nodes', async () => {
      const rows = [
        { id: 'a', parentId: null },
        { id: 'b', parentId: 'a' },
        { id: 'c', parentId: 'b' },
      ];
      mockDb.queueWhereResults(rows, undefined, undefined, undefined);

      const count = await service.backfillPaths(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
      );

      expect(count).toBe(3);

      const setCalls = mockDb.db.set.mock.calls;
      expect(setCalls[0][0]).toEqual({ path: '/a', depth: 0 });
      expect(setCalls[1][0]).toEqual({ path: '/a/b', depth: 1 });
      expect(setCalls[2][0]).toEqual({ path: '/a/b/c', depth: 2 });
    });

    it('handles rows returned in non-hierarchical order', async () => {
      // Child comes before parent in the array, but backfill still computes correctly
      // because it uses the rowMap to walk the parent chain
      const rows = [
        { id: 'child', parentId: 'parent' },
        { id: 'parent', parentId: null },
      ];
      mockDb.queueWhereResults(rows, undefined, undefined);

      const count = await service.backfillPaths(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
      );

      expect(count).toBe(2);

      const setCalls = mockDb.db.set.mock.calls;
      // First row processed is 'child', which walks up to 'parent'
      expect(setCalls[0][0]).toEqual({ path: '/parent/child', depth: 1 });
      // Second row is 'parent'
      expect(setCalls[1][0]).toEqual({ path: '/parent', depth: 0 });
    });

    it('calls update for each row in the table', async () => {
      const rows = [
        { id: 'a', parentId: null },
        { id: 'b', parentId: 'a' },
        { id: 'c', parentId: 'a' },
      ];
      mockDb.queueWhereResults(rows, undefined, undefined, undefined);

      await service.backfillPaths(
        mockTable,
        mockIdCol,
        mockParentIdCol,
        mockPathCol,
        mockDepthCol,
      );

      expect(mockDb.db.update).toHaveBeenCalledTimes(3);
      expect(mockDb.db.update).toHaveBeenCalledWith(mockTable);
    });
  });
});
