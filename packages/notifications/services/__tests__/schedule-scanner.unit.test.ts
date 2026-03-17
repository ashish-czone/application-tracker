import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleScanner } from '../schedule-scanner';
import { EntityResolverRegistry } from '../entity-resolver-registry';
import { TemplateRenderer } from '../template-renderer';
import type { NotificationRule } from '../../types';

/**
 * Tests for multi-offset aggregation and recipient grouping in ScheduleScanner.
 *
 * Verifies:
 * 1. Multiple date offsets produce separate entity queries
 * 2. Matched entities are grouped by recipient
 * 3. One dispatch call per recipient (aggregated)
 * 4. Dedup via sent log is respected
 * 5. Cross-offset entity dedup (same entity matched by two offsets)
 */

function buildScheduleRule(overrides: Partial<NotificationRule> = {}): NotificationRule {
  return {
    id: 'rule-1',
    name: 'Due Date Reminder',
    triggerType: 'schedule_recurring',
    eventName: null,
    delayAmount: null,
    delayUnit: null,
    scheduleEntityType: 'tasks',
    scheduleDateField: 'dueDate',
    scheduleDateOperator: 'before',
    scheduleDateAmounts: [7, 3, 1],
    scheduleDateUnit: 'days',
    conditions: null,
    recipientStrategy: 'entity_owner',
    recipientConfig: { field: 'ownerId' },
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockDeps() {
  // Two separate result queues:
  // - queryResults: for queries that are awaited directly (.where() as terminal)
  // - sentLogResults: for queries that chain .where().limit() (checkSentLog)
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

      // Return a thenable that also has .limit() for checkSentLog pattern
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

  const registry = new EntityResolverRegistry();
  const mockTable = {
    id: { name: 'id' },
    dueDate: { name: 'due_date' },
    ownerId: { name: 'owner_id' },
    name: { name: 'name' },
  };
  registry.register('tasks', {
    table: mockTable,
    fields: { dueDate: { type: 'date', label: 'Due Date' }, name: { type: 'text', label: 'Name' } },
    recipientFields: { ownerId: { label: 'Owner' } },
  });

  const ruleService = {
    findByIdWithChannels: vi.fn().mockResolvedValue({
      ...buildScheduleRule(),
      channels: [{
        channel: 'email' as const,
        template: {
          id: 'tmpl-1',
          name: 'Reminder',
          channel: 'email' as const,
          subject: 'You have {{entityCount}} reminders',
          body: '{{#entities}}{{name}} ({{scheduleDateOffset}} days){{/entities}}',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }],
    }),
    findActiveByEventName: vi.fn().mockResolvedValue([]),
  };

  const recipientResolver = {
    resolve: vi.fn().mockResolvedValue(['user-1']),
  };

  const preferenceService = {
    isEnabled: vi.fn().mockResolvedValue(true),
  };

  const templateRenderer = new TemplateRenderer();

  const dispatcher = {
    dispatch: vi.fn().mockResolvedValue(undefined),
  };

  const scanner = new ScheduleScanner(
    { db: mockDb } as any,
    registry,
    ruleService as any,
    recipientResolver as any,
    preferenceService as any,
    templateRenderer,
    dispatcher as any,
  );

  return {
    scanner,
    mockDb,
    queryResults,
    sentLogResults,
    ruleService,
    recipientResolver,
    preferenceService,
    dispatcher,
  };
}

describe('ScheduleScanner — multi-offset aggregation', () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
  });

  // NOTE: checkSentLog calls .select().from().where().limit(1)
  // The .where() call consumes a queryResults entry (value unused, result comes from sentLogResults via .limit()).
  // So we must interleave dummy [] entries for each checkSentLog call between entity queries.

  it('should query entities for each offset and dispatch one aggregated call', async () => {
    const rule = buildScheduleRule({ scheduleDateAmounts: [7, 3, 1] });

    deps.queryResults.push(
      [], // 0: processDelayedEvents
      [rule], // 1: processScheduleRules
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }], // 2: offset 7 entities
      [], // 3: checkSentLog for task-1 (result from sentLogResults)
      [{ id: 'task-2', name: 'Task B', dueDate: '2026-03-20', ownerId: 'user-1' }], // 4: offset 3 entities
      [], // 5: checkSentLog for task-2
      [{ id: 'task-3', name: 'Task C', dueDate: '2026-03-18', ownerId: 'user-1' }], // 6: offset 1 entities
      [], // 7: checkSentLog for task-3
    );
    deps.sentLogResults.push([], [], []); // all not sent yet

    await deps.scanner.scan();

    expect(deps.dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [channel, recipientId, content] = deps.dispatcher.dispatch.mock.calls[0];
    expect(channel).toBe('email');
    expect(recipientId).toBe('user-1');
    expect(content.subject).toBe('You have 3 reminders');
    expect(content.body).toContain('Task A');
    expect(content.body).toContain('Task B');
    expect(content.body).toContain('Task C');
  });

  it('should aggregate entities by recipient into one dispatch', async () => {
    const rule = buildScheduleRule({ scheduleDateAmounts: [7, 3] });

    deps.queryResults.push(
      [], // delayed events
      [rule], // schedule rules
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }], // offset 7
      [], // checkSentLog for task-1
      [{ id: 'task-2', name: 'Task B', dueDate: '2026-03-20', ownerId: 'user-1' }], // offset 3
      [], // checkSentLog for task-2
    );
    deps.sentLogResults.push([], []);

    await deps.scanner.scan();

    expect(deps.dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [, recipientId, content] = deps.dispatcher.dispatch.mock.calls[0];
    expect(recipientId).toBe('user-1');
    expect(content.subject).toBe('You have 2 reminders');
    expect(content.body).toContain('Task A');
    expect(content.body).toContain('Task B');
  });

  it('should dispatch separately for different recipients', async () => {
    const rule = buildScheduleRule({ scheduleDateAmounts: [7] });

    deps.queryResults.push(
      [], // delayed events
      [rule], // schedule rules
      [
        { id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' },
        { id: 'task-2', name: 'Task B', dueDate: '2026-03-24', ownerId: 'user-2' },
      ], // offset 7
      [], // checkSentLog for task-1
      [], // checkSentLog for task-2
    );
    deps.sentLogResults.push([], []);

    deps.recipientResolver.resolve
      .mockResolvedValueOnce(['user-1'])
      .mockResolvedValueOnce(['user-2']);

    await deps.scanner.scan();

    expect(deps.dispatcher.dispatch).toHaveBeenCalledTimes(2);
    const recipients = deps.dispatcher.dispatch.mock.calls.map((c: any[]) => c[1]);
    expect(recipients).toContain('user-1');
    expect(recipients).toContain('user-2');
  });

  it('should skip entities already in sent log', async () => {
    const rule = buildScheduleRule({ scheduleDateAmounts: [7] });

    deps.queryResults.push(
      [], // delayed events
      [rule], // schedule rules
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }], // offset 7
      [], // checkSentLog for task-1 (result from sentLogResults)
    );
    deps.sentLogResults.push([{ ruleId: 'rule-1' }]); // already sent

    await deps.scanner.scan();

    expect(deps.dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should not dispatch when no entities match any offset', async () => {
    const rule = buildScheduleRule({ scheduleDateAmounts: [7, 3] });

    deps.queryResults.push(
      [], // delayed events
      [rule], // schedule rules
      [], // offset 7 — no matches
      [], // offset 3 — no matches
    );

    await deps.scanner.scan();

    expect(deps.dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should skip channel when recipient preference is disabled', async () => {
    const rule = buildScheduleRule({ scheduleDateAmounts: [7] });

    deps.queryResults.push(
      [], // delayed events
      [rule], // schedule rules
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }],
      [], // checkSentLog
    );
    deps.sentLogResults.push([]);
    deps.preferenceService.isEnabled.mockResolvedValue(false);

    await deps.scanner.scan();

    expect(deps.dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should log sent for each matched entity after dispatch', async () => {
    const rule = buildScheduleRule({ scheduleDateAmounts: [7] });

    deps.queryResults.push(
      [], // delayed events
      [rule], // schedule rules
      [
        { id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' },
        { id: 'task-2', name: 'Task B', dueDate: '2026-03-24', ownerId: 'user-1' },
      ],
      [], // checkSentLog for task-1
      [], // checkSentLog for task-2
    );
    deps.sentLogResults.push([], []);

    await deps.scanner.scan();

    // insert() called twice — once per entity in sent log
    expect(deps.mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('should deduplicate entities matched by multiple offsets', async () => {
    const rule = buildScheduleRule({ scheduleDateAmounts: [7, 3] });

    deps.queryResults.push(
      [], // delayed events
      [rule], // schedule rules
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }], // offset 7
      [], // checkSentLog for task-1
      [{ id: 'task-1', name: 'Task A', dueDate: '2026-03-24', ownerId: 'user-1' }], // offset 3 — same entity (deduped by seenEntityIds)
    );
    deps.sentLogResults.push([]);

    await deps.scanner.scan();

    expect(deps.dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const content = deps.dispatcher.dispatch.mock.calls[0][2];
    expect(content.subject).toBe('You have 1 reminders');
  });
});
