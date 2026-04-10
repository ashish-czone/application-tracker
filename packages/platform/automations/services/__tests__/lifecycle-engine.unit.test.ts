import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LifecycleEngine } from '../lifecycle-engine';
import { AutomationRuleService } from '../automation-rule.service';
import { ActionRegistry } from '../action-registry';
import { ProvenanceService } from '../provenance.service';
import type { DomainEvent } from '@packages/events';
import type { AutomationRule, ActionHandler } from '../../types';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventName: 'interviews.InterviewUpdated',
    entityType: 'interviews',
    entityId: 'int-1',
    actorId: 'actor-1',
    correlationId: 'corr-1',
    occurredAt: '2026-01-01T00:00:00Z',
    payload: {},
    ...overrides,
  };
}

function buildRuleWithLifecycle(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    name: 'Interview follow-up',
    description: null,
    triggerType: 'event',
    eventName: 'interviews.InterviewScheduled',
    delayAmount: null,
    delayUnit: null,
    scheduleEntityType: null,
    scheduleDateField: null,
    scheduleDateOperator: null,
    scheduleDateAmounts: null,
    scheduleDateUnit: null,
    scheduleDaysOfWeek: null,
    conditions: null,
    actions: [{
      type: 'create_task',
      config: { title: 'Prepare' },
      link: { as: 'prep_task' },
    }],
    onSourceUpdated: [{
      conditions: [{ field: 'scheduledDate', operator: 'changed' }],
      linked: 'prep_task',
      action: 'update',
      set: { dueDate: '{{payload.after.scheduledDate}}' },
    }],
    onSourceDeleted: [{
      linked: 'prep_task',
      action: 'update',
      set: { status: 'cancelled' },
    }],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LifecycleEngine', () => {
  let ruleService: AutomationRuleService;
  let actionRegistry: ActionRegistry;
  let provenanceService: ProvenanceService;
  let engine: LifecycleEngine;
  let mockHandler: ActionHandler & { update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const mockLogger = createMockAppLogger();
    const mockDb = { db: {} } as any;

    ruleService = new AutomationRuleService(mockDb);
    actionRegistry = new ActionRegistry(mockLogger);
    provenanceService = new ProvenanceService(mockDb, mockLogger);

    mockHandler = {
      type: 'create_task',
      label: 'Create Task',
      userSlots: [],
      configSchema: {},
      execute: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    actionRegistry.register(mockHandler);

    engine = new LifecycleEngine(
      ruleService,
      actionRegistry,
      provenanceService,
      mockLogger,
    );
  });

  describe('onSourceUpdated', () => {
    it('should update linked entities when conditions pass', async () => {
      vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([buildRuleWithLifecycle()]);
      vi.spyOn(provenanceService, 'findLinked').mockResolvedValue([{
        id: 'log-1',
        ruleId: 'rule-1',
        actionIndex: 0,
        linkName: 'prep_task',
        sourceEntityType: 'interviews',
        sourceEntityId: 'int-1',
        targetEntityType: 'tasks',
        targetEntityId: 'task-1',
        createdAt: new Date(),
      }]);

      await engine.handleDomainEvent(buildEvent({
        payload: {
          changes: ['scheduledDate'],
          after: { scheduledDate: '2026-04-15' },
        },
      }));

      expect(mockHandler.update).toHaveBeenCalledWith(
        'task-1',
        { dueDate: '2026-04-15' },
        expect.objectContaining({ rule: expect.objectContaining({ id: 'rule-1' }) }),
      );
    });

    it('should skip when lifecycle conditions fail', async () => {
      vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([buildRuleWithLifecycle()]);

      await engine.handleDomainEvent(buildEvent({
        payload: {
          changes: ['notes'],  // scheduledDate not changed
          after: { notes: 'updated' },
        },
      }));

      expect(mockHandler.update).not.toHaveBeenCalled();
    });

    it('should skip when no linked entities found', async () => {
      vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([buildRuleWithLifecycle()]);
      vi.spyOn(provenanceService, 'findLinked').mockResolvedValue([]);

      await engine.handleDomainEvent(buildEvent({
        payload: { changes: ['scheduledDate'], after: { scheduledDate: '2026-04-15' } },
      }));

      expect(mockHandler.update).not.toHaveBeenCalled();
    });

    it('should skip when rule entity type does not match event', async () => {
      vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([buildRuleWithLifecycle()]);

      await engine.handleDomainEvent(buildEvent({
        eventName: 'tasks.TaskUpdated',
        entityType: 'tasks',
      }));

      expect(mockHandler.update).not.toHaveBeenCalled();
    });

    it('should continue if one linked entity update fails', async () => {
      vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([buildRuleWithLifecycle()]);
      vi.spyOn(provenanceService, 'findLinked').mockResolvedValue([
        { id: 'log-1', ruleId: 'rule-1', actionIndex: 0, linkName: 'prep_task', sourceEntityType: 'interviews', sourceEntityId: 'int-1', targetEntityType: 'tasks', targetEntityId: 'task-1', createdAt: new Date() },
        { id: 'log-2', ruleId: 'rule-1', actionIndex: 0, linkName: 'prep_task', sourceEntityType: 'interviews', sourceEntityId: 'int-1', targetEntityType: 'tasks', targetEntityId: 'task-2', createdAt: new Date() },
      ]);

      mockHandler.update
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined);

      await engine.handleDomainEvent(buildEvent({
        payload: { changes: ['scheduledDate'], after: { scheduledDate: '2026-04-15' } },
      }));

      expect(mockHandler.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('onSourceDeleted', () => {
    it('should apply delete binding (update action) to linked entities', async () => {
      vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([buildRuleWithLifecycle()]);
      vi.spyOn(provenanceService, 'findLinked').mockResolvedValue([{
        id: 'log-1', ruleId: 'rule-1', actionIndex: 0, linkName: 'prep_task',
        sourceEntityType: 'interviews', sourceEntityId: 'int-1',
        targetEntityType: 'tasks', targetEntityId: 'task-1', createdAt: new Date(),
      }]);
      vi.spyOn(provenanceService, 'removeBySource').mockResolvedValue(undefined);

      await engine.handleDomainEvent(buildEvent({
        eventName: 'interviews.InterviewDeleted',
      }));

      expect(mockHandler.update).toHaveBeenCalledWith(
        'task-1',
        { status: 'cancelled' },
        expect.objectContaining({ rule: expect.objectContaining({ id: 'rule-1' }) }),
      );
    });

    it('should call handler.delete when binding action is delete', async () => {
      const rule = buildRuleWithLifecycle({
        onSourceDeleted: [{ linked: 'prep_task', action: 'delete' }],
      });

      vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([rule]);
      vi.spyOn(provenanceService, 'findLinked').mockResolvedValue([{
        id: 'log-1', ruleId: 'rule-1', actionIndex: 0, linkName: 'prep_task',
        sourceEntityType: 'interviews', sourceEntityId: 'int-1',
        targetEntityType: 'tasks', targetEntityId: 'task-1', createdAt: new Date(),
      }]);
      vi.spyOn(provenanceService, 'removeBySource').mockResolvedValue(undefined);

      await engine.handleDomainEvent(buildEvent({
        eventName: 'interviews.InterviewDeleted',
      }));

      expect(mockHandler.delete).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ rule: expect.objectContaining({ id: 'rule-1' }) }),
      );
    });

    it('should clean up provenance after processing delete bindings', async () => {
      vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([buildRuleWithLifecycle()]);
      vi.spyOn(provenanceService, 'findLinked').mockResolvedValue([{
        id: 'log-1', ruleId: 'rule-1', actionIndex: 0, linkName: 'prep_task',
        sourceEntityType: 'interviews', sourceEntityId: 'int-1',
        targetEntityType: 'tasks', targetEntityId: 'task-1', createdAt: new Date(),
      }]);
      const removeSpy = vi.spyOn(provenanceService, 'removeBySource').mockResolvedValue(undefined);

      await engine.handleDomainEvent(buildEvent({
        eventName: 'interviews.InterviewDeleted',
      }));

      expect(removeSpy).toHaveBeenCalledWith('interviews', 'int-1');
    });
  });

  it('should not crash on lifecycle engine error', async () => {
    vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockRejectedValue(new Error('db down'));

    await engine.handleDomainEvent(buildEvent());

    expect(mockHandler.update).not.toHaveBeenCalled();
  });

  it('should skip when no rules have lifecycle bindings', async () => {
    vi.spyOn(ruleService, 'findActiveWithLifecycleBindings').mockResolvedValue([]);

    await engine.handleDomainEvent(buildEvent());

    expect(mockHandler.update).not.toHaveBeenCalled();
  });
});
