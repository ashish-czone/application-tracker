import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransitionWorkflowAction } from '../transition-workflow.action';
import type { ActionContext } from '@packages/automation-contracts';

vi.mock('@packages/automation-contracts', () => ({
  interpolateValues: vi.fn((obj, _ctx) => obj),
}));

import { interpolateValues } from '@packages/automation-contracts';

const mockWorkflowEngine = {
  getEntityState: vi.fn(),
  validateAndThrow: vi.fn(),
};

const mockModuleRef = { get: vi.fn() };

const mockLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const mockAppLogger = { forContext: vi.fn().mockReturnValue(mockLogger) } as any;

function buildContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    rule: { id: 'rule-1', name: 'Test Rule' } as any,
    actionIndex: 0,
    actionConfig: {
      type: 'transition_workflow',
      config: {
        workflowSlug: 'task-status',
        fieldKey: 'status',
        targetState: 'approved',
      },
    },
    event: {
      eventName: 'tasks.TaskUpdated',
      entityType: 'task',
      entityId: 'entity-123',
      actorId: 'user-1',
      correlationId: 'corr-1',
      payload: {},
    },
    resolvedUsers: {},
    ...overrides,
  };
}

describe('TransitionWorkflowAction', () => {
  let action: TransitionWorkflowAction;
  let mockEntityService: { update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockEntityService = { update: vi.fn().mockResolvedValue({}) };

    mockWorkflowEngine.getEntityState.mockResolvedValue('draft');
    mockWorkflowEngine.validateAndThrow.mockResolvedValue({});
    mockModuleRef.get.mockReturnValue(mockEntityService);

    action = new TransitionWorkflowAction(
      mockModuleRef as any,
      mockWorkflowEngine as any,
      mockAppLogger,
    );
  });

  it('should have correct type and label', () => {
    expect(action.type).toBe('transition_workflow');
    expect(action.label).toBe('Transition Workflow');
  });

  describe('missing config fields', () => {
    it('should return early if workflowSlug is missing', async () => {
      const ctx = buildContext({
        actionConfig: { type: 'transition_workflow', config: { fieldKey: 'status', targetState: 'approved' } },
      });
      const result = await action.execute(ctx);

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Missing workflowSlug'));
      expect(mockWorkflowEngine.getEntityState).not.toHaveBeenCalled();
    });

    it('should return early if fieldKey is missing', async () => {
      const ctx = buildContext({
        actionConfig: { type: 'transition_workflow', config: { workflowSlug: 'task-status', targetState: 'approved' } },
      });
      const result = await action.execute(ctx);

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Missing workflowSlug'));
    });

    it('should return early if targetState is missing', async () => {
      const ctx = buildContext({
        actionConfig: { type: 'transition_workflow', config: { workflowSlug: 'task-status', fieldKey: 'status' } },
      });
      const result = await action.execute(ctx);

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Missing workflowSlug'));
    });
  });

  describe('entity resolution', () => {
    it('should fall back to event entityType and entityId when not in config', async () => {
      const ctx = buildContext();

      await action.execute(ctx);

      expect(mockWorkflowEngine.getEntityState).toHaveBeenCalledWith('task-status', 'task', 'entity-123');
    });

    it('should use config entityType and entityId when provided', async () => {
      const ctx = buildContext({
        actionConfig: {
          type: 'transition_workflow',
          config: {
            workflowSlug: 'task-status',
            fieldKey: 'status',
            targetState: 'approved',
            entityType: 'project',
            entityId: 'proj-456',
          },
        },
      });

      await action.execute(ctx);

      expect(mockWorkflowEngine.getEntityState).toHaveBeenCalledWith('task-status', 'project', 'proj-456');
    });

    it('should return early if no entity context is available', async () => {
      const ctx = buildContext({
        actionConfig: {
          type: 'transition_workflow',
          config: { workflowSlug: 'task-status', fieldKey: 'status', targetState: 'approved' },
        },
        event: undefined,
      });

      const result = await action.execute(ctx);

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith('No entity context available for transition_workflow action');
    });

    it('should call interpolateValues for entityId', async () => {
      const ctx = buildContext({
        actionConfig: {
          type: 'transition_workflow',
          config: {
            workflowSlug: 'task-status',
            fieldKey: 'status',
            targetState: 'approved',
            entityId: '{{event.entityId}}',
          },
        },
      });

      await action.execute(ctx);

      expect(interpolateValues).toHaveBeenCalledWith(
        { id: '{{event.entityId}}' },
        expect.objectContaining({ event: ctx.event }),
      );
    });
  });

  describe('workflow state checks', () => {
    it('should return early if no current state is found', async () => {
      mockWorkflowEngine.getEntityState.mockResolvedValue(null);

      const ctx = buildContext();
      const result = await action.execute(ctx);

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No workflow state found'),
      );
      expect(mockWorkflowEngine.validateAndThrow).not.toHaveBeenCalled();
    });

    it('should return early if entity is already in target state', async () => {
      mockWorkflowEngine.getEntityState.mockResolvedValue('approved');

      const ctx = buildContext();
      const result = await action.execute(ctx);

      expect(result).toEqual({});
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Entity already in target state — skipping',
        expect.objectContaining({ targetState: 'approved' }),
      );
      expect(mockWorkflowEngine.validateAndThrow).not.toHaveBeenCalled();
    });
  });

  describe('entity service resolution', () => {
    it('should return early if no entity service is found', async () => {
      mockModuleRef.get.mockImplementation(() => {
        throw new Error('Not found');
      });

      const ctx = buildContext();
      const result = await action.execute(ctx);

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity service found'),
      );
    });

    it('should look up entity service with correct token', async () => {
      const ctx = buildContext();

      await action.execute(ctx);

      expect(mockModuleRef.get).toHaveBeenCalledWith('ENTITY_SERVICE_task', { strict: false });
    });
  });

  describe('successful transition', () => {
    it('should validate, update entity, and log success', async () => {
      const ctx = buildContext();

      const result = await action.execute(ctx);

      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith({
        workflowSlug: 'task-status',
        entityType: 'task',
        entityId: 'entity-123',
        fromState: 'draft',
        toState: 'approved',
        actorId: 'user-1',
        entityData: undefined,
      });
      expect(mockEntityService.update).toHaveBeenCalledWith('entity-123', { status: 'approved' }, 'user-1');
      expect(result).toEqual({});
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Workflow transitioned',
        expect.objectContaining({
          entityType: 'task',
          entityId: 'entity-123',
          from: 'draft',
          to: 'approved',
        }),
      );
    });

    it('should pass entityData from event payload after snapshot', async () => {
      const ctx = buildContext({
        event: {
          eventName: 'tasks.TaskUpdated',
          entityType: 'task',
          entityId: 'entity-123',
          actorId: 'user-1',
          correlationId: 'corr-1',
          payload: { after: { status: 'draft', name: 'My Task' } },
        },
      });

      await action.execute(ctx);

      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          entityData: { status: 'draft', name: 'My Task' },
        }),
      );
    });
  });

  describe('actorId fallback', () => {
    it('should use event actorId when available', async () => {
      const ctx = buildContext();

      await action.execute(ctx);

      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'user-1' }),
      );
      expect(mockEntityService.update).toHaveBeenCalledWith('entity-123', { status: 'approved' }, 'user-1');
    });

    it('should fall back to system when event actorId is null', async () => {
      const ctx = buildContext({
        event: {
          eventName: 'tasks.TaskUpdated',
          entityType: 'task',
          entityId: 'entity-123',
          actorId: null,
          correlationId: 'corr-1',
          payload: {},
        },
      });

      await action.execute(ctx);

      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'system' }),
      );
      expect(mockEntityService.update).toHaveBeenCalledWith('entity-123', { status: 'approved' }, 'system');
    });
  });
});
