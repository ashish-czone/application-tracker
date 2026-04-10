import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionLogService } from '../execution-log.service';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function createCountChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  // count query: select().from().where() — where resolves the promise
  chain.where = vi.fn().mockResolvedValue(result);
  chain.from = vi.fn().mockReturnValue(chain);
  return chain;
}

function createDataChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  // data query: select().from().leftJoin().where().orderBy().limit().offset()
  chain.offset = vi.fn().mockResolvedValue(result);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('ExecutionLogService', () => {
  let service: ExecutionLogService;
  let mockInsertValues: ReturnType<typeof vi.fn>;
  let mockDeleteWhere: ReturnType<typeof vi.fn>;
  let mockDeleteReturning: ReturnType<typeof vi.fn>;
  let mockDataChain: ReturnType<typeof createDataChain>;
  let mockCountChain: ReturnType<typeof createCountChain>;
  let mockSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockInsertValues = vi.fn().mockResolvedValue(undefined);
    mockDeleteReturning = vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]);
    mockDeleteWhere = vi.fn().mockReturnValue({ returning: mockDeleteReturning });

    mockDataChain = createDataChain([]);
    mockCountChain = createCountChain([{ total: 0 }]);

    let selectCallCount = 0;
    mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++;
      // First select call is the count query, second is the data query
      return selectCallCount % 2 === 1 ? mockCountChain : mockDataChain;
    });

    const mockDb = {
      db: {
        insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
        delete: vi.fn().mockReturnValue({ where: mockDeleteWhere }),
        select: mockSelect,
      },
    };

    service = new ExecutionLogService(mockDb as any, createMockAppLogger());
  });

  describe('log', () => {
    it('should insert an execution log entry', async () => {
      await service.log({
        ruleId: 'rule-1',
        actionIndex: 0,
        actionType: 'create_entity',
        entityType: 'tasks',
        entityId: 'task-1',
        status: 'success',
      });

      expect(mockInsertValues).toHaveBeenCalledWith({
        ruleId: 'rule-1',
        actionIndex: 0,
        actionType: 'create_entity',
        entityType: 'tasks',
        entityId: 'task-1',
        status: 'success',
      });
    });

    it('should include errorMessage for failed executions', async () => {
      await service.log({
        ruleId: 'rule-1',
        actionIndex: 1,
        actionType: 'webhook',
        entityType: 'tasks',
        entityId: 'task-1',
        status: 'error',
        errorMessage: 'Connection timeout',
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          errorMessage: 'Connection timeout',
        }),
      );
    });

    it('should not throw on insert failure', async () => {
      mockInsertValues.mockRejectedValue(new Error('db error'));

      await expect(
        service.log({
          ruleId: 'rule-1',
          actionIndex: 0,
          actionType: 'webhook',
          entityType: 'tasks',
          entityId: 'task-1',
          status: 'success',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('should return paginated execution logs with rule names', async () => {
      const mockData = [
        {
          id: 'exec-1', ruleId: 'rule-1', ruleName: 'My Rule',
          actionIndex: 0, actionType: 'create_entity',
          entityType: 'tasks', entityId: 'task-1',
          status: 'success', errorMessage: null,
          executedAt: new Date('2026-01-01'),
        },
      ];
      mockCountChain.where.mockResolvedValue([{ total: 1 }]);
      mockDataChain.offset.mockResolvedValue(mockData);

      const result = await service.list({ page: 1, limit: 25 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ruleName).toBe('My Rule');
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 25, totalPages: 1 });
    });

    it('should default ruleName to "Deleted rule" when rule is missing', async () => {
      mockCountChain.where.mockResolvedValue([{ total: 1 }]);
      mockDataChain.offset.mockResolvedValue([{
        id: 'exec-1', ruleId: 'rule-deleted', ruleName: null,
        actionIndex: 0, actionType: 'webhook',
        entityType: 'tasks', entityId: 'task-1',
        status: 'error', errorMessage: 'Not found',
        executedAt: new Date('2026-01-01'),
      }]);

      const result = await service.list({});

      expect(result.data[0].ruleName).toBe('Deleted rule');
    });

    it('should apply filters when provided', async () => {
      mockCountChain.where.mockResolvedValue([{ total: 0 }]);
      mockDataChain.offset.mockResolvedValue([]);

      await service.list({ ruleId: 'rule-1', status: 'error', entityType: 'tasks', actionType: 'webhook' });

      // Count query applies where clause
      expect(mockCountChain.where).toHaveBeenCalled();
      // Data query applies where clause
      expect(mockDataChain.where).toHaveBeenCalled();
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete entries older than specified days and return count', async () => {
      const count = await service.deleteOlderThan(90);

      expect(count).toBe(2);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });
});
