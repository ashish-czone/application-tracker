import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionLogService } from '../execution-log.service';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

describe('ExecutionLogService', () => {
  let service: ExecutionLogService;
  let mockInsertValues: ReturnType<typeof vi.fn>;
  let mockDeleteWhere: ReturnType<typeof vi.fn>;
  let mockDeleteReturning: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockInsertValues = vi.fn().mockResolvedValue(undefined);
    mockDeleteReturning = vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]);
    mockDeleteWhere = vi.fn().mockReturnValue({ returning: mockDeleteReturning });

    const mockDb = {
      db: {
        insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
        delete: vi.fn().mockReturnValue({ where: mockDeleteWhere }),
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

  describe('deleteOlderThan', () => {
    it('should delete entries older than specified days and return count', async () => {
      const count = await service.deleteOlderThan(90);

      expect(count).toBe(2);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });
});
