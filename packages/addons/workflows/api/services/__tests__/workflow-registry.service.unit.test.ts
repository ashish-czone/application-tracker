import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkflowRegistryService, isCodeDefinedWorkflowId } from '../workflow-registry.service';
import { defineWorkflow } from '../../define-workflow';

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
        { id: 'state-1', workflowDefinitionId: 'def-1', name: 'draft', label: 'Draft', color: '#gray', sortOrder: 0, isSystem: true, metadata: null, createdAt: new Date(), updatedAt: new Date() },
        { id: 'state-2', workflowDefinitionId: 'def-1', name: 'submitted', label: 'Submitted', color: '#blue', sortOrder: 1, isSystem: false, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      ];

      const mockTransitions = [
        { id: 'trans-1', workflowDefinitionId: 'def-1', fromStateId: 'state-1', toStateId: 'state-2', name: 'Submit', requiredPermissions: ['tasks.submit'], sortOrder: 0, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockLoadAll(mockDb, mockDefinitions, mockStates, mockTransitions);

      await service.loadAll();

      const cached = service.getBySlug('task-status');
      expect(cached).toBeDefined();
      expect(cached!.slug).toBe('task-status');
      expect(cached!.entityType).toBe('task');
      expect(cached!.fieldName).toBe('status');
      expect(cached!.states).toHaveLength(2);
      expect(cached!.states[0].isSystem).toBe(true);
      expect(cached!.states[1].isSystem).toBe(false);
      expect(cached!.transitions).toHaveLength(1);
      expect(cached!.transitions[0].fromStateName).toBe('draft');
      expect(cached!.transitions[0].toStateName).toBe('submitted');
      expect(cached!.transitions[0].requiredPermissions).toEqual(['tasks.submit']);

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

  describe('registerInMemory (code-defined workflows)', () => {
    const TEST_WORKFLOW = defineWorkflow({
      slug: 'test-status',
      entityType: 'tests',
      fieldName: 'status',
      initialState: 'draft',
      states: [
        { name: 'draft', label: 'Draft', isSystem: true },
        { name: 'active', label: 'Active', color: '#10B981' },
      ],
      transitions: [
        { from: 'draft', to: ['active'] },
        { from: 'active', to: [{ state: 'draft', requiredPermissions: ['tests.revert'] }] },
      ],
    });

    it('marks the entry as source=code with a code:-prefixed id', () => {
      service.registerInMemory(TEST_WORKFLOW);
      const cached = service.getBySlug('test-status');
      expect(cached).toBeDefined();
      expect(cached!.source).toBe('code');
      expect(cached!.id).toBe('code:test-status');
      expect(isCodeDefinedWorkflowId(cached!.id)).toBe(true);
    });

    it('builds states with deterministic code:-prefixed ids', () => {
      service.registerInMemory(TEST_WORKFLOW);
      const cached = service.getBySlug('test-status')!;
      expect(cached.states.map((s) => s.id)).toEqual([
        'code:test-status:state:draft',
        'code:test-status:state:active',
      ]);
      expect(cached.states[0].isSystem).toBe(true);
    });

    it('expands transition targets and preserves transition metadata', () => {
      service.registerInMemory(TEST_WORKFLOW);
      const cached = service.getBySlug('test-status')!;
      expect(cached.transitions).toHaveLength(2);
      expect(cached.transitions[0].fromStateName).toBe('draft');
      expect(cached.transitions[0].toStateName).toBe('active');
      expect(cached.transitions[1].requiredPermissions).toEqual(['tests.revert']);
    });

    it('is idempotent — re-registering the same slug replaces the entry', () => {
      service.registerInMemory(TEST_WORKFLOW);
      service.registerInMemory(TEST_WORKFLOW);
      expect(service.getAll()).toHaveLength(1);
    });

    it('survives loadAll() — admin entries are cleared but code entries persist', async () => {
      service.registerInMemory(TEST_WORKFLOW);
      mockLoadAll(mockDb, [], [], []);
      await service.loadAll();
      expect(service.getBySlug('test-status')).toBeDefined();
      expect(service.getBySlug('test-status')!.source).toBe('code');
    });
  });

  describe('mutation guards reject code-defined ids', () => {
    it('updateDefinition rejects code: ids', async () => {
      await expect(
        service.updateDefinition('code:test-status', { name: 'Edited' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deleteDefinition rejects code: ids', async () => {
      await expect(service.deleteDefinition('code:test-status')).rejects.toThrow(BadRequestException);
    });

    it('createState rejects when the parent definition is code-defined', async () => {
      await expect(
        service.createState('code:test-status', { name: 'paused', label: 'Paused' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateState/deleteState/createTransition/updateTransition/deleteTransition all reject code: ids', async () => {
      await expect(service.updateState('code:test-status:state:draft', { label: 'X' })).rejects.toThrow(BadRequestException);
      await expect(service.deleteState('code:test-status:state:draft')).rejects.toThrow(BadRequestException);
      await expect(service.createTransition('code:test-status', { fromStateId: 'a', toStateId: 'b', name: 't' })).rejects.toThrow(BadRequestException);
      await expect(service.updateTransition('code:test-status:transition:0', { name: 'X' })).rejects.toThrow(BadRequestException);
      await expect(service.deleteTransition('code:test-status:transition:0')).rejects.toThrow(BadRequestException);
    });
  });
});
