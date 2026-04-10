import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { WorkflowEngineService } from '../workflow-engine.service';
import { WorkflowRegistryService } from '../workflow-registry.service';
import { WorkflowGuardRegistry } from '../workflow-guard-registry.service';
import type { RbacService } from '@packages/rbac';
import type { CachedWorkflowDefinition } from '../../types';

const mockContextLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockAppLogger = {
  forContext: vi.fn().mockReturnValue(mockContextLogger),
} as any;

const mockDefinition: CachedWorkflowDefinition = {
  id: 'def-1',
  slug: 'task-status',
  name: 'Task Status',
  entityType: 'task',
  fieldName: 'status',
  initialState: 'draft',
  isActive: true,
  states: [
    { id: 'state-1', name: 'draft', label: 'Draft', color: '#gray', sortOrder: 0, metadata: null },
    { id: 'state-2', name: 'submitted', label: 'Submitted', color: '#blue', sortOrder: 1, metadata: null },
    { id: 'state-3', name: 'approved', label: 'Approved', color: '#green', sortOrder: 2, metadata: null },
    { id: 'state-4', name: 'rejected', label: 'Rejected', color: '#red', sortOrder: 3, metadata: null },
  ],
  transitions: [
    {
      id: 'trans-1',
      fromStateName: 'draft',
      toStateName: 'submitted',
      name: 'Submit',
      requiredPermissions: [],
      guardNames: [],
      sortOrder: 0,
      metadata: null,
    },
    {
      id: 'trans-2',
      fromStateName: 'submitted',
      toStateName: 'approved',
      name: 'Approve',
      requiredPermissions: ['tasks.approve'],
      guardNames: ['not-same-actor'],
      sortOrder: 0,
      metadata: null,
    },
    {
      id: 'trans-3',
      fromStateName: 'submitted',
      toStateName: 'rejected',
      name: 'Reject',
      requiredPermissions: ['tasks.approve'],
      guardNames: [],
      sortOrder: 1,
      metadata: null,
    },
  ],
};

describe('WorkflowEngineService', () => {
  let engine: WorkflowEngineService;
  let registryMock: { getBySlug: ReturnType<typeof vi.fn> };
  let guardRegistryMock: WorkflowGuardRegistry;
  let mockDb: any;
  let rbacServiceMock: { getPermissionsForUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    registryMock = {
      getBySlug: vi.fn().mockReturnValue(mockDefinition),
    };

    guardRegistryMock = new WorkflowGuardRegistry(mockAppLogger);

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    };

    rbacServiceMock = {
      getPermissionsForUser: vi.fn().mockResolvedValue({
        'tasks.approve': true,
        'tasks.create': true,
      }),
    };

    engine = new WorkflowEngineService(
      registryMock as unknown as WorkflowRegistryService,
      guardRegistryMock,
      { db: mockDb } as any,
      rbacServiceMock as unknown as RbacService,
    );
  });

  describe('getAvailableTransitions', () => {
    it('should return transitions from current state', () => {
      const result = engine.getAvailableTransitions('task-status', 'submitted');
      expect(result).toHaveLength(2);
      expect(result[0].transitionName).toBe('Approve');
      expect(result[0].toState).toBe('approved');
      expect(result[0].toStateLabel).toBe('Approved');
      expect(result[0].toStateColor).toBe('#green');
      expect(result[0].requiredPermissions).toEqual(['tasks.approve']);
      expect(result[1].transitionName).toBe('Reject');
    });

    it('should return empty array when no transitions from state', () => {
      const result = engine.getAvailableTransitions('task-status', 'approved');
      expect(result).toEqual([]);
    });

    it('should throw NotFoundException for unknown workflow', () => {
      registryMock.getBySlug.mockReturnValue(undefined);
      expect(() => engine.getAvailableTransitions('unknown', 'draft')).toThrow(NotFoundException);
    });
  });

  describe('validateTransition', () => {
    it('should return valid for allowed transition without guards', async () => {
      const result = await engine.validateTransition('task-status', 'draft', 'submitted');
      expect(result).toEqual({ valid: true, transitionId: 'trans-1' });
    });

    it('should return invalid for disallowed transition', async () => {
      const result = await engine.validateTransition('task-status', 'draft', 'approved');
      expect(result).toEqual({ valid: false });
    });

    it('should check required permissions and return missing', async () => {
      rbacServiceMock.getPermissionsForUser.mockResolvedValue({});

      const result = await engine.validateTransition('task-status', 'submitted', 'approved', {
        entityId: 'entity-1',
        entityType: 'task',
        actorId: 'user-1',
      });

      expect(result.valid).toBe(false);
      expect(result.missingPermissions).toEqual(['tasks.approve']);
    });

    it('should pass when actor has required permissions', async () => {
      guardRegistryMock.register('not-same-actor', async () => true);

      const result = await engine.validateTransition('task-status', 'submitted', 'approved', {
        entityId: 'entity-1',
        entityType: 'task',
        actorId: 'user-1',
      });

      expect(result.valid).toBe(true);
      expect(result.transitionId).toBe('trans-2');
    });

    it('should return failed guard name when guard rejects', async () => {
      guardRegistryMock.register('not-same-actor', async () => false);

      const result = await engine.validateTransition('task-status', 'submitted', 'approved', {
        entityId: 'entity-1',
        entityType: 'task',
        actorId: 'user-1',
      });

      expect(result.valid).toBe(false);
      expect(result.failedGuard).toBe('not-same-actor');
    });
  });

  describe('validateAndThrow', () => {
    it('should return validated transition for allowed transition', async () => {
      const result = await engine.validateAndThrow({
        workflowSlug: 'task-status',
        entityType: 'task',
        entityId: 'entity-1',
        fromState: 'draft',
        toState: 'submitted',
        actorId: 'user-1',
      });

      expect(result.transitionId).toBe('trans-1');
      expect(result.transitionName).toBe('Submit');
      expect(result.workflowDefinitionId).toBe('def-1');
      expect(result.workflowName).toBe('Task Status');
      expect(result.fieldName).toBe('status');
    });

    it('should throw UnprocessableEntityException for invalid transition', async () => {
      await expect(
        engine.validateAndThrow({
          workflowSlug: 'task-status',
          entityType: 'task',
          entityId: 'entity-1',
          fromState: 'draft',
          toState: 'approved',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw ForbiddenException when permissions are missing', async () => {
      rbacServiceMock.getPermissionsForUser.mockResolvedValue({});

      await expect(
        engine.validateAndThrow({
          workflowSlug: 'task-status',
          entityType: 'task',
          entityId: 'entity-1',
          fromState: 'submitted',
          toState: 'approved',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw when guard fails', async () => {
      guardRegistryMock.register('not-same-actor', async () => false);

      await expect(
        engine.validateAndThrow({
          workflowSlug: 'task-status',
          entityType: 'task',
          entityId: 'entity-1',
          fromState: 'submitted',
          toState: 'approved',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should execute additionalGuards and throw on failure', async () => {
      await expect(
        engine.validateAndThrow({
          workflowSlug: 'task-status',
          entityType: 'task',
          entityId: 'entity-1',
          fromState: 'draft',
          toState: 'submitted',
          actorId: 'user-1',
          additionalGuards: [async () => false],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw NotFoundException for unknown workflow', async () => {
      registryMock.getBySlug.mockReturnValue(undefined);

      await expect(
        engine.validateAndThrow({
          workflowSlug: 'unknown',
          entityType: 'task',
          entityId: 'entity-1',
          fromState: 'draft',
          toState: 'submitted',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordHistory', () => {
    it('should insert history row using provided transaction', async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: 'history-1',
          createdAt: new Date('2026-03-17T00:00:00Z'),
        },
      ]);
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({ returning: mockReturning }),
        }),
      };

      const result = await engine.recordHistory({
        workflowDefinitionId: 'def-1',
        entityType: 'task',
        entityId: 'entity-1',
        fieldName: 'status',
        fromState: 'draft',
        toState: 'submitted',
        transitionId: 'trans-1',
        actorId: 'user-1',
        comment: 'Submitting task',
      }, mockTx);

      expect(result.historyId).toBe('history-1');
      expect(result.recordedAt).toBe('2026-03-17T00:00:00.000Z');
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return history entries for an entity', async () => {
      const mockHistory = [
        {
          id: 'h-1',
          workflowDefinitionId: 'def-1',
          entityType: 'task',
          entityId: 'entity-1',
          fieldName: 'status',
          fromState: 'draft',
          toState: 'submitted',
          transitionId: 'trans-1',
          actorId: 'user-1',
          comment: null,
          metadata: null,
          createdAt: new Date('2026-03-17T00:00:00Z'),
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockHistory),
              }),
            }),
          }),
        }),
      });

      const result = await engine.getHistory('task', 'entity-1');
      expect(result).toHaveLength(1);
      expect(result[0].fromState).toBe('draft');
      expect(result[0].toState).toBe('submitted');
    });

    it('should support pagination', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const result = await engine.getHistory('task', 'entity-1', { limit: 10, offset: 5 });
      expect(result).toEqual([]);
    });
  });

  describe('getEntityState', () => {
    it('should return latest to_state from history', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ toState: 'submitted' }]),
            }),
          }),
        }),
      });

      const result = await engine.getEntityState('task-status', 'task', 'entity-1');
      expect(result).toBe('submitted');
    });

    it('should return null when no history exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await engine.getEntityState('task-status', 'task', 'entity-1');
      expect(result).toBeNull();
    });

    it('should throw NotFoundException for unknown workflow', async () => {
      registryMock.getBySlug.mockReturnValue(undefined);
      await expect(engine.getEntityState('unknown', 'task', 'entity-1')).rejects.toThrow(NotFoundException);
    });
  });
});
