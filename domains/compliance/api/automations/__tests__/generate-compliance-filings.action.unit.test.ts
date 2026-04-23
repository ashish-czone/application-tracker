import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerateComplianceFilingsAction } from '../generate-compliance-filings.action';
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

describe('GenerateComplianceFilingsAction', () => {
  let ruleService: {
    findById: Mock;
    expandRule: Mock;
    resolveAssignee: Mock;
  };
  let clientRegistrationService: { getRegistrationsForLaw: Mock };
  let filingsService: {
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
  let action: GenerateComplianceFilingsAction;

  beforeEach(() => {
    ruleService = {
      findById: vi.fn().mockResolvedValue(null),
      expandRule: vi.fn().mockReturnValue([]),
      resolveAssignee: vi.fn().mockResolvedValue('org-1'),
    };
    clientRegistrationService = { getRegistrationsForLaw: vi.fn().mockResolvedValue([]) };
    filingsService = {
      findByRuleClientPeriod: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'filing-new' }),
    };
    events = { emitDynamic: vi.fn() };

    const ctxLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    logger = {
      forContext: vi.fn().mockReturnValue(ctxLogger),
      ...ctxLogger,
    };

    // Lookup (findByRuleClientPeriod) and EntityService (create) share a
    // single stub — the action holds them as separate references but the
    // assertions only need one handle to both sides.
    action = new GenerateComplianceFilingsAction(
      ruleService as never,
      clientRegistrationService as never,
      filingsService as never,
      filingsService as never,
      events as never,
      logger as never,
    );
  });

  it('no-ops when context has no rule id', async () => {
    await action.execute(ctxFor(undefined));

    expect(ruleService.findById).not.toHaveBeenCalled();
    expect(filingsService.create).not.toHaveBeenCalled();
  });

  it('no-ops when rule is not found', async () => {
    ruleService.findById.mockResolvedValue(null);

    await action.execute(ctxFor('r1'));

    expect(clientRegistrationService.getRegistrationsForLaw).not.toHaveBeenCalled();
    expect(filingsService.create).not.toHaveBeenCalled();
  });

  it('no-ops when rule is inactive', async () => {
    ruleService.findById.mockResolvedValue(makeRule({ active: false }));

    await action.execute(ctxFor('r1'));

    expect(clientRegistrationService.getRegistrationsForLaw).not.toHaveBeenCalled();
    expect(filingsService.create).not.toHaveBeenCalled();
  });

  it('skips when there are no registered clients', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegistrationsForLaw.mockResolvedValue([]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    await action.execute(ctxFor('r1'));

    expect(filingsService.create).not.toHaveBeenCalled();
  });

  it('creates one filing per (client × occurrence) with the right compliance fields', async () => {
    const rule = makeRule();
    ruleService.findById.mockResolvedValue(rule);
    clientRegistrationService.getRegistrationsForLaw.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      { periodStart: utc(2026, 5, 1), periodEnd: utc(2026, 5, 31), dueDate: utc(2026, 6, 20) },
    ]);

    await action.execute(ctxFor('r1'));

    expect(filingsService.create).toHaveBeenCalledTimes(2);

    const firstCall = filingsService.create.mock.calls[0]!;
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
  });

  it('emits COMPLIANCE_FILING_GENERATED with the compliance projection', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegistrationsForLaw.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);
    filingsService.create.mockResolvedValue({ id: 'filing-123', externalKey: 'r1:c1:2026-04-01' });

    await action.execute(ctxFor('r1'));

    expect(events.emitDynamic).toHaveBeenCalledTimes(1);
    const [eventName, envelope] = events.emitDynamic.mock.calls[0]!;
    expect(eventName).toBe('compliance.ComplianceFilingGenerated');
    expect(envelope.entityType).toBe('compliance_rules');
    expect(envelope.payload).toMatchObject({
      ruleId: 'r1',
      clientId: 'c1',
      lawId: 'l1',
      filingId: 'filing-123',
      externalKey: 'r1:c1:2026-04-01',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      dueDate: '2026-05-20',
    });
  });

  it('is idempotent — existing filing by (rule, client, period) is skipped', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegistrationsForLaw.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);
    filingsService.findByRuleClientPeriod.mockResolvedValue({ id: 'existing' });

    await action.execute(ctxFor('r1'));

    expect(filingsService.create).not.toHaveBeenCalled();
  });

  it('propagates AmbiguousHandlerError from resolveAssignee', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegistrationsForLaw.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);
    ruleService.resolveAssignee.mockRejectedValue(
      new AmbiguousHandlerError('l1', 'c1', 'client-any'),
    );

    await expect(action.execute(ctxFor('r1'))).rejects.toBeInstanceOf(AmbiguousHandlerError);
    expect(filingsService.create).not.toHaveBeenCalled();
  });

  it('I6: includes deactivated registrations for periods that started on or before deactivatedAt; skips later periods', async () => {
    // Registration deactivated on 2026-04-15. Per Q8:
    //   - period starting 2026-04-01 (before deactivation) → generate
    //   - period starting 2026-05-01 (after deactivation) → skip
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegistrationsForLaw.mockResolvedValue([
      {
        id: 'reg1',
        clientId: 'c1',
        lawId: 'l1',
        registeredAt: utc(2025, 1, 1),
        deactivatedAt: utc(2026, 4, 15),
      },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      { periodStart: utc(2026, 5, 1), periodEnd: utc(2026, 5, 31), dueDate: utc(2026, 6, 20) },
    ]);

    await action.execute(ctxFor('r1'));

    expect(filingsService.create).toHaveBeenCalledTimes(1);
    expect(filingsService.create.mock.calls[0]![0]).toMatchObject({ periodStart: '2026-04-01' });
  });

  it('I6: skips every period when deactivatedAt is before the horizon (all periods fall after)', async () => {
    ruleService.findById.mockResolvedValue(makeRule());
    clientRegistrationService.getRegistrationsForLaw.mockResolvedValue([
      {
        id: 'reg1',
        clientId: 'c1',
        lawId: 'l1',
        registeredAt: utc(2025, 1, 1),
        deactivatedAt: utc(2025, 12, 31),
      },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      { periodStart: utc(2026, 5, 1), periodEnd: utc(2026, 5, 31), dueDate: utc(2026, 6, 20) },
    ]);

    await action.execute(ctxFor('r1'));

    expect(filingsService.create).not.toHaveBeenCalled();
  });

  it('repeat firings do not create duplicates — natural-key guard protects retries', async () => {
    const rule = makeRule();
    ruleService.findById.mockResolvedValue(rule);
    clientRegistrationService.getRegistrationsForLaw.mockResolvedValue([
      { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
    ]);
    ruleService.expandRule.mockReturnValue([
      { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
    ]);

    filingsService.findByRuleClientPeriod.mockResolvedValueOnce(null);
    await action.execute(ctxFor('r1'));
    expect(filingsService.create).toHaveBeenCalledTimes(1);

    filingsService.findByRuleClientPeriod.mockResolvedValueOnce({ id: 'filing-new' });
    await action.execute(ctxFor('r1'));
    expect(filingsService.create).toHaveBeenCalledTimes(1);
  });
});
