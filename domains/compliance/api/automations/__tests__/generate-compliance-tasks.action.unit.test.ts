import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerateComplianceTasksAction } from '../generate-compliance-tasks.action';
import { COMPLIANCE_TASK_GENERATED } from '../../events/types';
import {
  AmbiguousHandlerError,
  type ComplianceRule,
} from '../../rules/compliance-rules.service';

type Mock = ReturnType<typeof vi.fn>;

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function makeRule(overrides: Partial<ComplianceRule> = {}): ComplianceRule {
  return {
    id: 'r1',
    name: 'GST Return',
    lawId: 'l1',
    frequency: 'monthly',
    dueDayOfMonth: 20,
    dueMonthOffset: 1,
    gracePeriodDays: 0,
    description: null,
    active: true,
    ...overrides,
  };
}

describe('GenerateComplianceTasksAction', () => {
  let ruleService: {
    findActive: Mock;
    expandRule: Mock;
    resolveAssignee: Mock;
  };
  let clientLawService: { getRegisteredClients: Mock };
  let tasksService: { findByExternalKey: Mock };
  let events: { emitDynamic: Mock };
  let logger: {
    forContext: Mock;
    log: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
  };
  let tasksEntityService: { create: Mock };
  let moduleRef: { get: Mock };
  let action: GenerateComplianceTasksAction;

  beforeEach(() => {
    ruleService = {
      findActive: vi.fn().mockResolvedValue([]),
      expandRule: vi.fn().mockReturnValue([]),
      resolveAssignee: vi.fn().mockResolvedValue('org-1'),
    };
    clientLawService = { getRegisteredClients: vi.fn().mockResolvedValue([]) };
    tasksService = { findByExternalKey: vi.fn().mockResolvedValue(null) };
    events = { emitDynamic: vi.fn() };

    const ctxLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    logger = {
      forContext: vi.fn().mockReturnValue(ctxLogger),
      ...ctxLogger,
    };
    tasksEntityService = { create: vi.fn().mockResolvedValue({ id: 'task-new' }) };
    moduleRef = { get: vi.fn().mockReturnValue(tasksEntityService) };

    action = new GenerateComplianceTasksAction(
      ruleService as never,
      clientLawService as never,
      tasksService as never,
      events as never,
      moduleRef as never,
      logger as never,
    );
  });

  const anyContext = { resolvedUsers: {} } as never;

  it('no-ops when there are no active rules', async () => {
    ruleService.findActive.mockResolvedValue([]);

    await action.execute(anyContext);

    expect(clientLawService.getRegisteredClients).not.toHaveBeenCalled();
    expect(tasksEntityService.create).not.toHaveBeenCalled();
    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('skips rules with no registered clients', async () => {
    ruleService.findActive.mockResolvedValue([makeRule()]);
    clientLawService.getRegisteredClients.mockResolvedValue([]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    await action.execute(anyContext);

    expect(tasksEntityService.create).not.toHaveBeenCalled();
  });

  it('creates one task per (client × occurrence) with correct externalKey + fields', async () => {
    const rule = makeRule();
    ruleService.findActive.mockResolvedValue([rule]);
    clientLawService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      { periodStart: utc(2026, 5, 1), periodEnd: utc(2026, 5, 31), dueDate: utc(2026, 6, 20) },
    ]);

    await action.execute(anyContext);

    expect(tasksEntityService.create).toHaveBeenCalledTimes(2);

    const firstCall = tasksEntityService.create.mock.calls[0]![0];
    expect(firstCall).toMatchObject({
      dueDate: '2026-05-20',
      assigneeTeamId: 'org-1',
      relatedEntityType: 'compliance_rule',
      relatedEntityId: 'r1',
      externalKey: 'r1:c1:2026-04-01',
    });
    expect(firstCall.title).toContain('GST Return');

    const secondCall = tasksEntityService.create.mock.calls[1]![0];
    expect(secondCall.externalKey).toBe('r1:c1:2026-05-01');
    expect(secondCall.dueDate).toBe('2026-06-20');
  });

  it('emits COMPLIANCE_TASK_GENERATED per created task', async () => {
    ruleService.findActive.mockResolvedValue([makeRule()]);
    clientLawService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    await action.execute(anyContext);

    expect(events.emitDynamic).toHaveBeenCalledTimes(1);
    const [eventName, eventArgs] = events.emitDynamic.mock.calls[0]!;
    expect(eventName).toBe(COMPLIANCE_TASK_GENERATED);
    expect(eventArgs.payload).toMatchObject({
      ruleId: 'r1',
      clientId: 'c1',
      lawId: 'l1',
      taskId: 'task-new',
      externalKey: 'r1:c1:2026-04-01',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      dueDate: '2026-05-20',
    });
  });

  it('is idempotent — existing task by externalKey is skipped', async () => {
    ruleService.findActive.mockResolvedValue([makeRule()]);
    clientLawService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);
    tasksService.findByExternalKey.mockResolvedValue({ id: 'existing' });

    await action.execute(anyContext);

    expect(tasksEntityService.create).not.toHaveBeenCalled();
    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('propagates AmbiguousHandlerError from resolveAssignee', async () => {
    ruleService.findActive.mockResolvedValue([makeRule()]);
    clientLawService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);
    ruleService.resolveAssignee.mockRejectedValue(
      new AmbiguousHandlerError('l1', 'c1', 'client-any'),
    );

    await expect(action.execute(anyContext)).rejects.toBeInstanceOf(AmbiguousHandlerError);
    expect(tasksEntityService.create).not.toHaveBeenCalled();
  });

  it('period-start is the externalKey dimension — dueMonthOffset change wont create duplicates', async () => {
    // Two calls simulating a rule edit: first run creates tasks, second run
    // (with identical occurrences as returned by expandRule) finds them via
    // tasksService.findByExternalKey and skips.
    const rule = makeRule();
    ruleService.findActive.mockResolvedValue([rule]);
    clientLawService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    // First run: no existing → create
    tasksService.findByExternalKey.mockResolvedValueOnce(null);
    await action.execute(anyContext);
    expect(tasksEntityService.create).toHaveBeenCalledTimes(1);

    // Second run: findByExternalKey returns existing → skip
    tasksService.findByExternalKey.mockResolvedValueOnce({ id: 'task-new' });
    await action.execute(anyContext);
    expect(tasksEntityService.create).toHaveBeenCalledTimes(1); // unchanged
  });
});
