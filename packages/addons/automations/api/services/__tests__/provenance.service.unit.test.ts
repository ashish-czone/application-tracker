import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProvenanceService } from '../provenance.service';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function createMockDb() {
  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{
      id: 'log-1',
      ruleId: 'rule-1',
      actionIndex: 0,
      linkName: 'follow_up',
      sourceEntityType: 'interviews',
      sourceEntityId: 'int-1',
      targetEntityType: 'tasks',
      targetEntityId: 'task-1',
      createdAt: new Date('2026-01-01'),
    }]),
  };

  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };

  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  return {
    db: {
      insert: vi.fn().mockReturnValue(mockInsertChain),
      select: vi.fn().mockReturnValue(mockSelectChain),
      delete: vi.fn().mockReturnValue(mockDeleteChain),
    },
    _insertChain: mockInsertChain,
    _selectChain: mockSelectChain,
    _deleteChain: mockDeleteChain,
  };
}

describe('ProvenanceService', () => {
  let service: ProvenanceService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new ProvenanceService(mockDb as any, createMockAppLogger());
  });

  describe('log', () => {
    it('should insert and return the provenance entry', async () => {
      const result = await service.log({
        ruleId: 'rule-1',
        actionIndex: 0,
        linkName: 'follow_up',
        sourceEntityType: 'interviews',
        sourceEntityId: 'int-1',
        targetEntityType: 'tasks',
        targetEntityId: 'task-1',
      });

      expect(mockDb.db.insert).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'log-1',
        ruleId: 'rule-1',
        actionIndex: 0,
        linkName: 'follow_up',
        sourceEntityType: 'interviews',
        sourceEntityId: 'int-1',
        targetEntityType: 'tasks',
        targetEntityId: 'task-1',
        createdAt: expect.any(Date),
      });
    });
  });

  describe('findLinked', () => {
    it('should query by rule, linkName, source entity', async () => {
      mockDb._selectChain.where.mockResolvedValueOnce([{
        id: 'log-1',
        ruleId: 'rule-1',
        actionIndex: 0,
        linkName: 'follow_up',
        sourceEntityType: 'interviews',
        sourceEntityId: 'int-1',
        targetEntityType: 'tasks',
        targetEntityId: 'task-1',
        createdAt: new Date(),
      }]);

      const result = await service.findLinked({
        ruleId: 'rule-1',
        linkName: 'follow_up',
        sourceEntityType: 'interviews',
        sourceEntityId: 'int-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0].targetEntityId).toBe('task-1');
    });

    it('should return empty array when no linked entries exist', async () => {
      const result = await service.findLinked({
        ruleId: 'rule-1',
        linkName: 'follow_up',
        sourceEntityType: 'interviews',
        sourceEntityId: 'int-1',
      });

      expect(result).toEqual([]);
    });
  });

  describe('hasLinked', () => {
    it('should return true when linked entries exist', async () => {
      mockDb._selectChain.where.mockResolvedValueOnce([{ id: 'log-1' }]);

      const result = await service.hasLinked({
        ruleId: 'rule-1',
        linkName: 'follow_up',
        sourceEntityType: 'interviews',
        sourceEntityId: 'int-1',
      });

      expect(result).toBe(true);
    });

    it('should return false when no linked entries exist', async () => {
      const result = await service.hasLinked({
        ruleId: 'rule-1',
        linkName: 'follow_up',
        sourceEntityType: 'interviews',
        sourceEntityId: 'int-1',
      });

      expect(result).toBe(false);
    });
  });

  describe('removeByTarget', () => {
    it('should delete entries by target entity', async () => {
      await service.removeByTarget('tasks', 'task-1');

      expect(mockDb.db.delete).toHaveBeenCalled();
      expect(mockDb._deleteChain.where).toHaveBeenCalled();
    });
  });

  describe('removeBySource', () => {
    it('should delete entries by source entity', async () => {
      await service.removeBySource('interviews', 'int-1');

      expect(mockDb.db.delete).toHaveBeenCalled();
      expect(mockDb._deleteChain.where).toHaveBeenCalled();
    });
  });
});
