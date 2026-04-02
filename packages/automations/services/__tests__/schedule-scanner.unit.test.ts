import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleScanner } from '../schedule-scanner';
import { AutomationRuleService } from '../automation-rule.service';
import { EntityResolverRegistry } from '../entity-resolver-registry';
import { AUTOMATION_EXECUTION_QUEUE } from '../../automations.module';
import type { AutomationRule } from '../../types';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function buildScheduleRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    name: 'Due Date Reminder',
    description: null,
    triggerType: 'schedule_recurring',
    eventName: null,
    delayAmount: null,
    delayUnit: null,
    scheduleEntityType: 'tasks',
    scheduleDateField: 'dueDate',
    scheduleDateOperator: 'before',
    scheduleDateAmounts: [7, 3, 1],
    scheduleDateUnit: 'days',
    scheduleDaysOfWeek: null,
    conditions: null,
    actions: [{ type: 'send_notification', config: {} }],
    onSourceUpdated: null,
    onSourceDeleted: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockDeps() {
  const queryResults: any[][] = [];
  let queryIndex = 0;
  const sentLogResults: any[][] = [];
  let sentLogIndex = 0;

  const mockDbChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      const idx = queryIndex;
      queryIndex++;
      const result = queryResults[idx] ?? [];

      return {
        limit: vi.fn().mockImplementation(() => {
          const slIdx = sentLogIndex;
          sentLogIndex++;
          return Promise.resolve(sentLogResults[slIdx] ?? []);
        }),
        then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
      };
    }),
  };

  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };

  const mockDb = {
    select: vi.fn().mockReturnValue(mockDbChain),
    insert: vi.fn().mockReturnValue(mockInsertChain),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  const mockLogger = createMockAppLogger();
  const registry = new EntityResolverRegistry(mockLogger);
  const mockTable = {
    id: { name: 'id' },
    dueDate: { name: 'due_date' },
    ownerId: { name: 'owner_id' },
    name: { name: 'name' },
  };
  registry.register('tasks', {
    table: mockTable,
    fields: { dueDate: { type: 'date', label: 'Due Date' }, name: { type: 'text', label: 'Name' } },
    userFields: { ownerId: { label: 'Owner' } },
  });

  const ruleService = new AutomationRuleService({ db: mockDb } as any);
  vi.spyOn(ruleService, 'findActiveScheduleRules').mockResolvedValue([]);
  vi.spyOn(ruleService, 'findByIdOrFail').mockResolvedValue(buildScheduleRule());

  const queueService = {
    enqueue: vi.fn().mockResolvedValue('job-id'),
  } as any;

  const scanner = new ScheduleScanner(
    { db: mockDb } as any,
    ruleService,
    queueService,
    registry,
    mockLogger,
  );

  return {
    scanner,
    mockDb,
    queryResults,
    sentLogResults,
    ruleService,
    queueService,
  };
}

describe('ScheduleScanner', () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
  });

  it('should enqueue a job for each matched entity in schedule rules', async () => {
    vi.spyOn(deps.ruleService, 'findActiveScheduleRules').mockResolvedValue([
      buildScheduleRule({ scheduleDateAmounts: [7] }),
    ]);

    deps.queryResults.push(
      [], // processDelayedEvents
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }], // entities
      [], // checkSentLog
    );
    deps.sentLogResults.push([]);

    await deps.scanner.scan();

    expect(deps.queueService.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.queueService.enqueue).toHaveBeenCalledWith(
      AUTOMATION_EXECUTION_QUEUE,
      expect.objectContaining({
        ruleId: 'rule-1',
        event: expect.objectContaining({
          entityType: 'tasks',
          entityId: 'task-1',
        }),
      }),
    );
  });

  it('should skip entities already in sent log', async () => {
    vi.spyOn(deps.ruleService, 'findActiveScheduleRules').mockResolvedValue([
      buildScheduleRule({ scheduleDateAmounts: [7] }),
    ]);

    deps.queryResults.push(
      [], // delayed events
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }],
      [], // checkSentLog
    );
    deps.sentLogResults.push([{ ruleId: 'rule-1' }]); // already sent

    await deps.scanner.scan();

    expect(deps.queueService.enqueue).not.toHaveBeenCalled();
  });

  it('should deduplicate entities matched by multiple offsets', async () => {
    vi.spyOn(deps.ruleService, 'findActiveScheduleRules').mockResolvedValue([
      buildScheduleRule({ scheduleDateAmounts: [7, 3] }),
    ]);

    deps.queryResults.push(
      [], // delayed events
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }], // offset 7
      [], // checkSentLog
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }], // offset 3 — same entity
    );
    deps.sentLogResults.push([]);

    await deps.scanner.scan();

    expect(deps.queueService.enqueue).toHaveBeenCalledTimes(1);
  });

  it('should not enqueue when no entities match', async () => {
    vi.spyOn(deps.ruleService, 'findActiveScheduleRules').mockResolvedValue([
      buildScheduleRule({ scheduleDateAmounts: [7] }),
    ]);

    deps.queryResults.push(
      [], // delayed events
      [], // no entities
    );

    await deps.scanner.scan();

    expect(deps.queueService.enqueue).not.toHaveBeenCalled();
  });

  it('should log sent for each matched entity after enqueuing', async () => {
    vi.spyOn(deps.ruleService, 'findActiveScheduleRules').mockResolvedValue([
      buildScheduleRule({ scheduleDateAmounts: [7] }),
    ]);

    deps.queryResults.push(
      [], // delayed events
      [
        { id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' },
        { id: 'task-2', name: 'Task B', dueDate: '2026-03-24', ownerId: 'user-1' },
      ],
      [], // checkSentLog task-1
      [], // checkSentLog task-2
    );
    deps.sentLogResults.push([], []);

    await deps.scanner.scan();

    expect(deps.mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('should enqueue delayed events for execution', async () => {
    vi.spyOn(deps.ruleService, 'findActiveScheduleRules').mockResolvedValue([]);

    deps.queryResults.push(
      [{
        id: 'sched-1',
        ruleId: 'rule-1',
        entityType: 'tasks',
        entityId: 'task-1',
        eventPayload: { eventName: 'tasks.TaskCreated', actorId: 'actor-1', correlationId: 'c-1', payload: {} },
        scheduledFor: new Date('2026-01-01'),
        sentAt: null,
        createdAt: new Date('2026-01-01'),
      }],
    );

    await deps.scanner.scan();

    expect(deps.queueService.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.queueService.enqueue).toHaveBeenCalledWith(
      AUTOMATION_EXECUTION_QUEUE,
      expect.objectContaining({
        ruleId: 'rule-1',
        event: expect.objectContaining({
          entityType: 'tasks',
          entityId: 'task-1',
          eventName: 'tasks.TaskCreated',
        }),
      }),
    );
  });

  it('should not crash on scan errors', async () => {
    vi.spyOn(deps.ruleService, 'findActiveScheduleRules').mockRejectedValue(new Error('db down'));
    deps.queryResults.push([]); // delayed events

    await deps.scanner.scan();

    expect(deps.queueService.enqueue).not.toHaveBeenCalled();
  });
});
