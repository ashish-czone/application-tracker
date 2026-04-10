import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AuditQueryService } from '../audit-query.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
  tenantCondition: vi.fn().mockReturnValue(true),
}));

// --- Mock helpers ---

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  };

  return {
    db: {
      select: vi.fn().mockReturnValue(mockChain),
    },
    _chain: mockChain,
  };
}

// --- Fixtures ---

const now = new Date('2026-01-15T10:00:00.000Z');

function makeAuditRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    entityType: 'candidates',
    entityId: 'c-1',
    action: 'created',
    eventName: 'candidates.CandidateCreated',
    actorId: 'user-1',
    actorName: null,
    before: null,
    after: { firstName: 'Alice' },
    changes: null,
    correlationId: 'corr-1',
    targetEntityType: null,
    targetEntityId: null,
    occurredAt: now,
    createdAt: now,
    ...overrides,
  };
}

// --- Tests ---

describe('AuditQueryService', () => {
  let service: AuditQueryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new AuditQueryService(mockDb as any);
  });

  // ──────────────────────────────────────────────────────────
  // list()
  // ──────────────────────────────────────────────────────────

  describe('list', () => {
    function setupListMocks(rows: any[], total: number) {
      const dataChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(rows),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total }]),
      };
      // Users lookup for resolveActorNames
      const usersChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.db.select
        .mockReturnValueOnce(dataChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(usersChain);

      return { dataChain, countChain, usersChain };
    }

    it('should return paginated results with correct meta', async () => {
      const record = makeAuditRecord({ actorId: null });
      setupListMocks([record], 1);

      const result = await service.list({ page: 1, limit: 10 });

      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityType).toBe('candidates');
    });

    it('should default to page 1 and limit 25', async () => {
      setupListMocks([], 0);

      const result = await service.list();

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
    });

    it('should calculate offset correctly for page > 1', async () => {
      const { dataChain } = setupListMocks([], 0);

      await service.list({ page: 3, limit: 10 });

      expect(dataChain.offset).toHaveBeenCalledWith(20);
    });

    it('should calculate totalPages correctly (ceiling division)', async () => {
      setupListMocks([], 11);

      const result = await service.list({ limit: 5 });

      expect(result.meta.totalPages).toBe(3); // ceil(11/5)
    });

    it('should return empty data array when no records found', async () => {
      setupListMocks([], 0);

      const result = await service.list();

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should resolve actor names for records with actorId', async () => {
      const record = makeAuditRecord({ actorId: 'user-1' });
      const dataChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([record]),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1 }]),
      };
      const usersChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 'user-1', firstName: 'Alice', lastName: 'Smith' },
        ]),
      };

      mockDb.db.select
        .mockReturnValueOnce(dataChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.list();

      expect(result.data[0].actorName).toBe('Alice Smith');
    });

    it('should skip actor name resolution when no actorIds', async () => {
      const record = makeAuditRecord({ actorId: null });
      setupListMocks([record], 1);

      const result = await service.list();

      // No users query needed (only 2 select calls: data + count)
      expect(result.data[0].actorName).toBeNull();
    });

    it('should set actorName to null when actor not found in users table', async () => {
      const record = makeAuditRecord({ actorId: 'deleted-user' });
      const dataChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([record]),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1 }]),
      };
      const usersChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]), // user not found
      };

      mockDb.db.select
        .mockReturnValueOnce(dataChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.list();

      expect(result.data[0].actorName).toBeNull();
    });

    it('should deduplicate actorIds for the users lookup', async () => {
      const record1 = makeAuditRecord({ id: 'audit-1', actorId: 'user-1' });
      const record2 = makeAuditRecord({ id: 'audit-2', actorId: 'user-1' });
      const dataChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([record1, record2]),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 2 }]),
      };
      const usersChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 'user-1', firstName: 'Alice', lastName: 'Smith' },
        ]),
      };

      mockDb.db.select
        .mockReturnValueOnce(dataChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.list();

      // Both records get the same actor name
      expect(result.data[0].actorName).toBe('Alice Smith');
      expect(result.data[1].actorName).toBe('Alice Smith');
    });

    it('should handle actor with only firstName', async () => {
      const record = makeAuditRecord({ actorId: 'user-1' });
      const dataChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([record]),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1 }]),
      };
      const usersChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 'user-1', firstName: 'Alice', lastName: null },
        ]),
      };

      mockDb.db.select
        .mockReturnValueOnce(dataChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.list();

      expect(result.data[0].actorName).toBe('Alice');
    });
  });

  // ──────────────────────────────────────────────────────────
  // findOneOrFail()
  // ──────────────────────────────────────────────────────────

  describe('findOneOrFail', () => {
    it('should return record when found', async () => {
      const record = makeAuditRecord({ actorId: null });
      mockDb._chain.limit.mockResolvedValueOnce([record]);

      const result = await service.findOneOrFail('audit-1');

      expect(result.id).toBe('audit-1');
      expect(result.entityType).toBe('candidates');
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findOneOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw with correct message when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findOneOrFail('nonexistent'))
        .rejects.toThrow('Audit log entry not found');
    });

    it('should resolve actor name for the returned record', async () => {
      const record = makeAuditRecord({ actorId: 'user-1' });

      // First select call: the main audit log query
      const mainChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([record]),
      };
      // Second select call: resolveActorNames users lookup
      const usersChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 'user-1', firstName: 'Bob', lastName: 'Jones' },
        ]),
      };
      mockDb.db.select
        .mockReturnValueOnce(mainChain)
        .mockReturnValueOnce(usersChain);

      const result = await service.findOneOrFail('audit-1');

      expect(result.actorName).toBe('Bob Jones');
    });

    it('should set actorName to null when record has no actorId', async () => {
      const record = makeAuditRecord({ actorId: null });
      mockDb._chain.limit.mockResolvedValueOnce([record]);

      const result = await service.findOneOrFail('audit-1');

      expect(result.actorName).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────
  // getEntityHistory()
  // ──────────────────────────────────────────────────────────

  describe('getEntityHistory', () => {
    it('should delegate to list with entityType and entityId', async () => {
      const listSpy = vi.spyOn(service, 'list').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 25, totalPages: 0 },
      });

      await service.getEntityHistory('candidates', 'c-1');

      expect(listSpy).toHaveBeenCalledWith({
        entityType: 'candidates',
        entityId: 'c-1',
      });
    });

    it('should pass through pagination params to list', async () => {
      const listSpy = vi.spyOn(service, 'list').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 2, limit: 10, totalPages: 0 },
      });

      await service.getEntityHistory('candidates', 'c-1', { page: 2, limit: 10 });

      expect(listSpy).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        entityType: 'candidates',
        entityId: 'c-1',
      });
    });

    it('should return the result from list', async () => {
      const record = makeAuditRecord();
      vi.spyOn(service, 'list').mockResolvedValue({
        data: [record as any],
        meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
      });

      const result = await service.getEntityHistory('candidates', 'c-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('audit-1');
      expect(result.meta.total).toBe(1);
    });
  });
});
