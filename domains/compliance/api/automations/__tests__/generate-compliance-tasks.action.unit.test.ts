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

function ctxFor(ruleId: string | undefined): never {
  return {
    event: ruleId ? { entityId: ruleId, entityType: 'compliance_rules', eventName: '', actorId: null, correlationId: '', payload: {} } : undefined,
    resolvedUsers: {},
  } as never;
}

describe('GenerateComplianceTasksAction', () => {
  let ruleService: {
    findById: Mock;
    expandRule: Mock;
    resolveAssignee: Mock;
  };
  let clientRegistrationService: { getRegisteredClients: Mock };
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
      findById: vi.fn().mockResolvedValue(null),
      expandRule: vi.fn().mockReturnValue([]),
      resolveAssignee: vi.fn().mockResolvedValue('org-1'),
    };
    clientRegistrationService = { getRegisteredClients: vi.fn().mockResolvedValue([]) };
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
      clientRegistrationService as never,
      tasksService as never,
      events as never,
      moduleRef as never,
      logger as never,
    );
  });

  it('no-ops when context has no rule id', async () => {
    await action.execute(ctxFor(undefined));

    expect(ruleService.findById).not.toHaveBeenCalled();
    expect(tasksEntityService.create).not.toHaveBeenCalled();
    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('no-ops when rule is not found', async () => {
    ruleService.findById.mockResolvedValue(null);

    await action.execute(ctxFor('r1'));

    expect(clientRegistrationService.getRegisteredClients).not.toHaveBeenCalled();
    expect(tasksEntityService.create).not.toHaveBeenCalled();
  });

  it('no-ops when rule is inactive', async () => {
    ruleService.findById.mockResolvedValue(makeRule({ active: false }));

    await action.execute(ctxFor('r1'));

    expect(clientRegistrationService.getRegisteredClients).not.toHaveBeenCalled();
    expect(tasksEntityService.create).not.toHaveBeenCalled();
  });

  it('skips when there are no registered clients', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegisteredClients.mockResolvedValue([]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    await action.execute(ctxFor('r1'));

    expect(tasksEntityService.create).not.toHaveBeenCalled();
  });

  it('creates one task per (client × occurrence) with correct externalKey + fields', async () => {
    const rule = makeRule();
    ruleService.findById.mockResolvedValue(rule);
    clientRegistrationService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      { periodStart: utc(2026, 5, 1), periodEnd: utc(2026, 5, 31), dueDate: utc(2026, 6, 20) },
    ]);

    await action.execute(ctxFor('r1'));

    expect(tasksEntityService.create).toHaveBeenCalledTimes(2);

    const firstCall = tasksEntityService.create.mock.calls[0]![0];
    expect(firstCall).toMatchObject({
      dueDate: '2026-05-20',
      assigneeTeamId: 'org-1',
      kind: 'compliance',
      relatedEntityId: 'r1',
      externalKey: 'r1:c1:2026-04-01',
    });
    expect(firstCall.title).toContain('GST Return');

    const secondCall = tasksEntityService.create.mock.calls[1]![0];
    expect(secondCall.externalKey).toBe('r1:c1:2026-05-01');
    expect(secondCall.dueDate).toBe('2026-06-20');
  });

  it('emits COMPLIANCE_TASK_GENERATED per created task', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    await action.execute(ctxFor('r1'));

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
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);
    tasksService.findByExternalKey.mockResolvedValue({ id: 'existing' });

    await action.execute(ctxFor('r1'));

    expect(tasksEntityService.create).not.toHaveBeenCalled();
    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('propagates AmbiguousHandlerError from resolveAssignee', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);
    ruleService.resolveAssignee.mockRejectedValue(
      new AmbiguousHandlerError('l1', 'c1', 'client-any'),
    );

    await expect(action.execute(ctxFor('r1'))).rejects.toBeInstanceOf(AmbiguousHandlerError);
    expect(tasksEntityService.create).not.toHaveBeenCalled();
  });

  it('period-start is the externalKey dimension — repeat firings dont create duplicates', async () => {
    const rule = makeRule();
    ruleService.findById.mockResolvedValue(rule);
    clientRegistrationService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    // First firing: no existing → create
    tasksService.findByExternalKey.mockResolvedValueOnce(null);
    await action.execute(ctxFor('r1'));
    expect(tasksEntityService.create).toHaveBeenCalledTimes(1);

    // Second firing: findByExternalKey returns existing → skip
    tasksService.findByExternalKey.mockResolvedValueOnce({ id: 'task-new' });
    await action.execute(ctxFor('r1'));
    expect(tasksEntityService.create).toHaveBeenCalledTimes(1); // unchanged
  });
});
