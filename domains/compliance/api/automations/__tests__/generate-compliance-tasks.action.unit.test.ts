import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerateComplianceTasksAction } from '../generate-compliance-tasks.action';
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
  let complianceTasksService: {
    findByRuleClientPeriod: Mock;
    create: Mock;
  };
  let events: { emitDynamic: Mock };
  let logger: {
    forContext: Mock;
    log: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
  };
  let action: GenerateComplianceTasksAction;

  beforeEach(() => {
    ruleService = {
      findById: vi.fn().mockResolvedValue(null),
      expandRule: vi.fn().mockReturnValue([]),
      resolveAssignee: vi.fn().mockResolvedValue('org-1'),
    };
    clientRegistrationService = { getRegisteredClients: vi.fn().mockResolvedValue([]) };
    complianceTasksService = {
      findByRuleClientPeriod: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'task-new' }),
    };
    events = { emitDynamic: vi.fn() };

    const ctxLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    logger = {
      forContext: vi.fn().mockReturnValue(ctxLogger),
      ...ctxLogger,
    };

    // Post-extensionOf (PR #918), the action takes a lookup service AND an
    // EntityService for compliance-tasks. We stub both with the same mock —
    // it carries the `findByRuleClientPeriod` the lookup needs and the
    // `create` the EntityService needs, and the assertions reference one
    // object either way.
    action = new GenerateComplianceTasksAction(
      ruleService as never,
      clientRegistrationService as never,
      complianceTasksService as never,
      complianceTasksService as never,
      events as never,
      logger as never,
    );
  });

  it('no-ops when context has no rule id', async () => {
    await action.execute(ctxFor(undefined));

    expect(ruleService.findById).not.toHaveBeenCalled();
    expect(complianceTasksService.create).not.toHaveBeenCalled();
  });

  it('no-ops when rule is not found', async () => {
    ruleService.findById.mockResolvedValue(null);

    await action.execute(ctxFor('r1'));

    expect(clientRegistrationService.getRegisteredClients).not.toHaveBeenCalled();
    expect(complianceTasksService.create).not.toHaveBeenCalled();
  });

  it('no-ops when rule is inactive', async () => {
    ruleService.findById.mockResolvedValue(makeRule({ active: false }));

    await action.execute(ctxFor('r1'));

    expect(clientRegistrationService.getRegisteredClients).not.toHaveBeenCalled();
    expect(complianceTasksService.create).not.toHaveBeenCalled();
  });

  it('skips when there are no registered clients', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegisteredClients.mockResolvedValue([]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    await action.execute(ctxFor('r1'));

    expect(complianceTasksService.create).not.toHaveBeenCalled();
  });

  it('creates one task per (client × occurrence) with correct compliance fields', async () => {
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

    expect(complianceTasksService.create).toHaveBeenCalledTimes(2);

    const firstCall = complianceTasksService.create.mock.calls[0]!;
    expect(firstCall[0]).toMatchObject({
      dueDate: '2026-05-20',
      assigneeTeamId: 'org-1',
      ruleId: 'r1',
      clientId: 'c1',
      lawId: 'l1',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    });
    expect(firstCall[0].title).toContain('GST Return');
    expect(firstCall[1]).toBe('system');

    const secondCall = complianceTasksService.create.mock.calls[1]!;
    expect(secondCall[0]).toMatchObject({
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      dueDate: '2026-06-20',
    });
  });

  it('is idempotent — existing task by (rule, client, period) is skipped', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);
    complianceTasksService.findByRuleClientPeriod.mockResolvedValue({ id: 'existing' });

    await action.execute(ctxFor('r1'));

    expect(complianceTasksService.create).not.toHaveBeenCalled();
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
    expect(complianceTasksService.create).not.toHaveBeenCalled();
  });

  it('period-start is the idempotency dimension — repeat firings dont create duplicates', async () => {
    const rule = makeRule();
    ruleService.findById.mockResolvedValue(rule);
    clientRegistrationService.getRegisteredClients.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    // First firing: no existing → create
    complianceTasksService.findByRuleClientPeriod.mockResolvedValueOnce(null);
    await action.execute(ctxFor('r1'));
    expect(complianceTasksService.create).toHaveBeenCalledTimes(1);

    // Second firing: existing found → skip
    complianceTasksService.findByRuleClientPeriod.mockResolvedValueOnce({ id: 'task-new' });
    await action.execute(ctxFor('r1'));
    expect(complianceTasksService.create).toHaveBeenCalledTimes(1); // unchanged
  });
});
