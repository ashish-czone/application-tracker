import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomationListener } from '../automation.listener';
import { AutomationRuleService } from '../../services/automation-rule.service';
import { ActionRegistry } from '../../services/action-registry';
import { UserResolverRegistry } from '../../services/user-resolver-registry';
import { EntityResolverRegistry } from '../../services/entity-resolver-registry';
import type { DomainEvent } from '@packages/events';
import type { AutomationRule, ActionHandler } from '../../types';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventName: 'tasks.TaskCreated',
    entityType: 'tasks',
    entityId: 'task-1',
    actorId: 'actor-1',
    correlationId: 'corr-1',
    occurredAt: '2026-01-01T00:00:00Z',
    payload: {},
    ...overrides,
  };
}

function buildRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    description: null,
    triggerType: 'event',
    eventName: 'tasks.TaskCreated',
    delayAmount: null,
    delayUnit: null,
    scheduleEntityType: null,
    scheduleDateField: null,
    scheduleDateOperator: null,
    scheduleDateAmounts: null,
    scheduleDateUnit: null,
    scheduleDaysOfWeek: null,
    conditions: null,
    actions: [{ type: 'test_action', config: {}, users: { recipient: { strategy: 'actor' } } }],
    onSourceUpdated: null,
    onSourceDeleted: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockHandler(): ActionHandler & { execute: ReturnType<typeof vi.fn> } {
  return {
    type: 'test_action',
    label: 'Test',
    userSlots: [],
    configSchema: {},
    execute: vi.fn().mockResolvedValue({}),
  };
}

describe('AutomationListener', () => {
  let ruleService: AutomationRuleService;
  let actionRegistry: ActionRegistry;
  let userResolverRegistry: UserResolverRegistry;
  let entityResolverRegistry: EntityResolverRegistry;
  let listener: AutomationListener;
  let mockDb: any;
  let mockHandler: ReturnType<typeof createMockHandler>;

  beforeEach(() => {
    const mockLogger = createMockAppLogger();
    mockDb = {
      db: {
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis() }),
      },
    };

    ruleService = new AutomationRuleService(mockDb);
    actionRegistry = new ActionRegistry(mockLogger);
    userResolverRegistry = new UserResolverRegistry(mockLogger);
    entityResolverRegistry = new EntityResolverRegistry(mockLogger);

    mockHandler = createMockHandler();
    actionRegistry.register(mockHandler);

    // Register actor strategy for user resolution
    userResolverRegistry.registerStrategy({
      type: 'actor',
      label: 'Actor',
      configSchema: {},
      resolve: async (_res, ctx) => ctx.event?.actorId ? [ctx.event.actorId] : [],
    });

    listener = new AutomationListener(
      ruleService,
      actionRegistry,
      userResolverRegistry,
      entityResolverRegistry,
      mockDb,
      mockLogger,
    );
  });

  it('should execute actions when rule matches event', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([buildRule()]);

    await listener.handleDomainEvent(buildEvent());

    expect(mockHandler.execute).toHaveBeenCalledOnce();
    expect(mockHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: expect.objectContaining({ id: 'rule-1' }),
        actionIndex: 0,
        resolvedUsers: { recipient: ['actor-1'] },
      }),
    );
  });

  it('should skip when no rules match', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([]);

    await listener.handleDomainEvent(buildEvent());

    expect(mockHandler.execute).not.toHaveBeenCalled();
  });

  it('should skip action when handler not found', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([
      buildRule({ actions: [{ type: 'unknown_action', config: {} }] }),
    ]);

    await listener.handleDomainEvent(buildEvent());

    expect(mockHandler.execute).not.toHaveBeenCalled();
  });

  it('should continue with other actions if one fails', async () => {
    const secondHandler: ActionHandler = {
      type: 'second_action',
      label: 'Second',
      userSlots: [],
      configSchema: {},
      execute: vi.fn().mockResolvedValue({}),
    };
    actionRegistry.register(secondHandler);

    mockHandler.execute.mockRejectedValueOnce(new Error('boom'));

    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([
      buildRule({
        actions: [
          { type: 'test_action', config: {} },
          { type: 'second_action', config: {} },
        ],
      }),
    ]);

    await listener.handleDomainEvent(buildEvent());

    expect(mockHandler.execute).toHaveBeenCalledOnce();
    expect(secondHandler.execute).toHaveBeenCalledOnce();
  });

  it('should skip rule when payload conditions fail', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([
      buildRule({
        conditions: [{ field: 'status', operator: 'changed_to', value: 'completed' }],
      }),
    ]);

    await listener.handleDomainEvent(buildEvent({
      payload: { changes: ['status'], after: { status: 'in_progress' } },
    }));

    expect(mockHandler.execute).not.toHaveBeenCalled();
  });

  it('should execute when payload conditions pass', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([
      buildRule({
        conditions: [{ field: 'status', operator: 'changed_to', value: 'completed' }],
      }),
    ]);

    await listener.handleDomainEvent(buildEvent({
      payload: { changes: ['status'], after: { status: 'completed' } },
    }));

    expect(mockHandler.execute).toHaveBeenCalledOnce();
  });

  it('should skip rule when state conditions fail against payload.after', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([
      buildRule({
        conditions: [{ field: 'priority', operator: 'eq', value: 'high' }],
      }),
    ]);

    await listener.handleDomainEvent(buildEvent({
      payload: { after: { priority: 'low' } },
    }));

    expect(mockHandler.execute).not.toHaveBeenCalled();
  });

  it('should execute when state conditions pass against payload.after', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([
      buildRule({
        conditions: [{ field: 'priority', operator: 'eq', value: 'high' }],
      }),
    ]);

    await listener.handleDomainEvent(buildEvent({
      payload: { after: { priority: 'high' } },
    }));

    expect(mockHandler.execute).toHaveBeenCalledOnce();
  });

  it('should resolve users with empty object when no users config', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([
      buildRule({ actions: [{ type: 'test_action', config: {} }] }),
    ]);

    await listener.handleDomainEvent(buildEvent());

    expect(mockHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ resolvedUsers: {} }),
    );
  });

  it('should not crash on listener error', async () => {
    vi.spyOn(ruleService, 'findActiveByEventName').mockRejectedValue(new Error('db down'));

    // Should not throw
    await listener.handleDomainEvent(buildEvent());

    expect(mockHandler.execute).not.toHaveBeenCalled();
  });

  it('should schedule delayed rule instead of executing immediately', async () => {
    const insertValues = vi.fn().mockReturnThis();
    mockDb.db.insert = vi.fn().mockReturnValue({ values: insertValues });

    vi.spyOn(ruleService, 'findActiveByEventName').mockResolvedValue([
      buildRule({ delayAmount: 30, delayUnit: 'minutes' }),
    ]);

    await listener.handleDomainEvent(buildEvent());

    expect(mockHandler.execute).not.toHaveBeenCalled();
    expect(mockDb.db.insert).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'rule-1',
        entityType: 'tasks',
        entityId: 'task-1',
      }),
    );
  });
});
