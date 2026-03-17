import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WorkflowRegistryService } from '../workflow-registry.service';

// Creates a thenable object that also has query builder methods
// This simulates Drizzle's query builder which is both a promise and has chainable methods
function createQueryResult(data: any[]) {
  const result: any = Promise.resolve(data);
  result.where = vi.fn().mockReturnValue(Promise.resolve(data));
  return result;
}

function mockLoadAll(mockDb: any, definitions: any[] = [], states: any[] = [], transitions: any[] = []) {
  let callCount = 0;
  mockDb.select.mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return createQueryResult(definitions);
      if (callCount === 2) return createQueryResult(states);
      return createQueryResult(transitions);
    }),
  }));
}

describe('WorkflowRegistryService', () => {
  let service: WorkflowRegistryService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryResult([])),
      }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    service = new WorkflowRegistryService({ db: mockDb } as any);
  });

  describe('getBySlug', () => {
    it('should return undefined for unknown slug when cache is empty', () => {
      expect(service.getBySlug('nonexistent')).toBeUndefined();
    });
  });

  describe('getByEntityType', () => {
    it('should return empty array when no definitions match', () => {
      expect(service.getByEntityType('unknown')).toEqual([]);
    });
  });

  describe('getByEntityField', () => {
    it('should return undefined when no definition matches', () => {
      expect(service.getByEntityField('task', 'status')).toBeUndefined();
    });
  });

  describe('loadAll', () => {
    it('should populate cache from database', async () => {
      const mockDefinitions = [
        {
          id: 'def-1', slug: 'task-status', name: 'Task Status',
          entityType: 'task', fieldName: 'status', initialState: 'draft',
          isActive: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
        },
      ];

      const mockStates = [
        { id: 'state-1', workflowDefinitionId: 'def-1', name: 'draft', label: 'Draft', color: '#gray', sortOrder: 0, metadata: null, createdAt: new Date(), updatedAt: new Date() },
        { id: 'state-2', workflowDefinitionId: 'def-1', name: 'submitted', label: 'Submitted', color: '#blue', sortOrder: 1, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      ];

      const mockTransitions = [
        { id: 'trans-1', workflowDefinitionId: 'def-1', fromStateId: 'state-1', toStateId: 'state-2', name: 'Submit', requiredPermissions: ['tasks.submit'], guardNames: ['has-attachment'], sortOrder: 0, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockLoadAll(mockDb, mockDefinitions, mockStates, mockTransitions);

      await service.loadAll();

      const cached = service.getBySlug('task-status');
      expect(cached).toBeDefined();
      expect(cached!.slug).toBe('task-status');
      expect(cached!.entityType).toBe('task');
      expect(cached!.fieldName).toBe('status');
      expect(cached!.states).toHaveLength(2);
      expect(cached!.transitions).toHaveLength(1);
      expect(cached!.transitions[0].fromStateName).toBe('draft');
      expect(cached!.transitions[0].toStateName).toBe('submitted');
      expect(cached!.transitions[0].requiredPermissions).toEqual(['tasks.submit']);
      expect(cached!.transitions[0].guardNames).toEqual(['has-attachment']);

      // Also test getByEntityType and getByEntityField
      expect(service.getByEntityType('task')).toHaveLength(1);
      expect(service.getByEntityField('task', 'status')?.slug).toBe('task-status');
    });
  });

  describe('createDefinition', () => {
    it('should insert and reload cache', async () => {
      const newDef = {
        id: 'def-new', slug: 'new-workflow', name: 'New Workflow',
        entityType: 'order', fieldName: 'status', initialState: 'pending',
        isActive: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      };

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newDef]),
        }),
      });

      // Mock loadAll to return empty after insert
      mockLoadAll(mockDb);

      const result = await service.createDefinition({
        slug: 'new-workflow', name: 'New Workflow',
        entityType: 'order', fieldName: 'status', initialState: 'pending',
      });

      expect(result).toEqual(newDef);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('updateDefinition', () => {
    it('should throw NotFoundException for unknown id', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.updateDefinition('unknown-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDefinition', () => {
    it('should soft delete by setting deletedAt', async () => {
      const softDeleted = {
        id: 'def-1', slug: 'test', name: 'Test',
        entityType: 'task', fieldName: 'status', initialState: 'draft',
        isActive: true, deletedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
      };

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([softDeleted]),
          }),
        }),
      });

      // Mock loadAll after delete
      mockLoadAll(mockDb);

      await service.deleteDefinition('def-1');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.deleteDefinition('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });
});
