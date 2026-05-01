import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceFilingsGeneratorService } from '../compliance-filings-generator.service';
import {
  AmbiguousHandlerError,
  type ComplianceRule,
} from '../../rules';

type Mock = ReturnType<typeof vi.fn>;

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function makeRule(overrides: Partial<ComplianceRule> = {}): ComplianceRule {
  return {
    id: 'r1',
    code: 'GST-M',
    name: 'GST Return',
    lawId: 'l1',
    frequency: 'monthly',
    status: 'active',
    dueDayOfMonth: 20,
    dueMonthOffset: 1,
    gracePeriodDays: 0,
    description: null,
    ...overrides,
  };
}

describe('ComplianceFilingsGeneratorService', () => {
  let ruleService: {
    findById: Mock;
    findActive: Mock;
    expandRule: Mock;
    resolveAssignee: Mock;
  };
  let registrationService: {
    getRegistrationsForLaw: Mock;
    getRegisteredLaws: Mock;
    isClientActive: Mock;
  };
  let filingsService: {
    findByRuleClientPeriod: Mock;
    findExistingKeys: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
  };
  let events: { emitDynamic: Mock };
  let logger: {
    forContext: Mock;
    log: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
  };
  let service: ComplianceFilingsGeneratorService;

  beforeEach(() => {
    ruleService = {
      findById: vi.fn().mockResolvedValue(null),
      findActive: vi.fn().mockResolvedValue([]),
      expandRule: vi.fn().mockReturnValue([]),
      resolveAssignee: vi.fn().mockResolvedValue('org-1'),
    };
    registrationService = {
      getRegistrationsForLaw: vi.fn().mockResolvedValue([]),
      getRegisteredLaws: vi.fn().mockResolvedValue([]),
      isClientActive: vi.fn().mockResolvedValue(true),
    };
    filingsService = {
      findByRuleClientPeriod: vi.fn().mockResolvedValue(null),
      findExistingKeys: vi.fn().mockResolvedValue(new Set<string>()),
      create: vi.fn().mockResolvedValue({ id: 'filing-new' }),
      // I16: `update`/`delete` exist on the stub so a negative assertion can
      // catch any future regression that tries to mutate existing rows.
      update: vi.fn().mockResolvedValue({ id: 'filing-updated' }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    events = { emitDynamic: vi.fn() };

    const ctxLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    logger = {
      forContext: vi.fn().mockReturnValue(ctxLogger),
      ...ctxLogger,
    };

    // Lookup (findByRuleClientPeriod) and EntityService (create) share a
    // single stub — the service holds them as separate references but the
    // assertions only need one handle to both sides.
    service = new ComplianceFilingsGeneratorService(
      ruleService as never,
      registrationService as never,
      filingsService as never,
      filingsService as never,
      events as never,
      logger as never,
    );
  });

  // ---------------------------------------------------------------------------
  // generateForRule — covers what the automation action's path does today.
  // ---------------------------------------------------------------------------

  describe('generateForRule', () => {
    it('no-ops when rule is not found', async () => {
      ruleService.findById.mockResolvedValue(null);

      await service.generateForRule('r1');

      expect(registrationService.getRegistrationsForLaw).not.toHaveBeenCalled();
      expect(filingsService.create).not.toHaveBeenCalled();
    });

    it('I9 skips deprecated rules without querying registrations', async () => {
      ruleService.findById.mockResolvedValue(makeRule({ status: 'deprecated' }));

      await service.generateForRule('r1');

      expect(registrationService.getRegistrationsForLaw).not.toHaveBeenCalled();
      expect(filingsService.create).not.toHaveBeenCalled();
    });

    it('still generates for draft rules (deprecation is the only stop state)', async () => {
      ruleService.findById.mockResolvedValue(makeRule({ status: 'draft' }));
      registrationService.getRegistrationsForLaw.mockResolvedValue([]);

      await service.generateForRule('r1');

      expect(registrationService.getRegistrationsForLaw).toHaveBeenCalledWith('l1');
    });

    it('skips when there are no registered clients', async () => {
      ruleService.findById.mockResolvedValue(makeRule());
      registrationService.getRegistrationsForLaw.mockResolvedValue([]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);

      await service.generateForRule('r1');

      expect(filingsService.create).not.toHaveBeenCalled();
    });

    it('creates one filing per (client × occurrence) with the right compliance fields', async () => {
      const rule = makeRule();
      ruleService.findById.mockResolvedValue(rule);
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
        { periodStart: utc(2026, 5, 1), periodEnd: utc(2026, 5, 31), dueDate: utc(2026, 6, 20) },
      ]);

      await service.generateForRule('r1');

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
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);
      filingsService.create.mockResolvedValue({ id: 'filing-123', externalKey: 'r1:c1:2026-04-01' });

      await service.generateForRule('r1');

      expect(events.emitDynamic).toHaveBeenCalledTimes(1);
      const [eventName, envelope] = events.emitDynamic.mock.calls[0]!;
      expect(eventName).toBe('compliance.ComplianceFilingGenerated');
      expect(envelope.entityType).toBe('compliance-rules');
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

    it('I16: on (ruleId, clientId, periodStart) conflict the generator is a pure no-op — no create, no update, no delete, no event', async () => {
      // Rule has been edited after a filing was already materialised — the due-
      // date math says 2026-05-25, but the existing filing was generated under
      // the old math (2026-05-20). Q9 is strict forward-only on due-date math:
      // already-generated filings keep their original dueDate. The generator
      // must NOT rewrite the existing row.
      ruleService.findById.mockResolvedValue(makeRule({ dueDayOfMonth: 25 }));
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 25) },
      ]);
      filingsService.findExistingKeys.mockResolvedValue(new Set(['c1:2026-04-01']));

      await service.generateForRule('r1');

      expect(filingsService.create).not.toHaveBeenCalled();
      expect(filingsService.update).not.toHaveBeenCalled();
      expect(filingsService.delete).not.toHaveBeenCalled();
      expect(events.emitDynamic).not.toHaveBeenCalled();
      // resolveAssignee is cost-free on conflict; don't overfit.
    });

    it('is idempotent — existing filing by (rule, client, period) is skipped', async () => {
      ruleService.findById.mockResolvedValue(makeRule());
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);
      filingsService.findExistingKeys.mockResolvedValue(new Set(['c1:2026-04-01']));

      await service.generateForRule('r1');

      expect(filingsService.create).not.toHaveBeenCalled();
    });

    it('propagates AmbiguousHandlerError from resolveAssignee', async () => {
      ruleService.findById.mockResolvedValue(makeRule());
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);
      ruleService.resolveAssignee.mockRejectedValue(
        new AmbiguousHandlerError('l1', 'c1', 'client-any'),
      );

      await expect(service.generateForRule('r1')).rejects.toBeInstanceOf(AmbiguousHandlerError);
      expect(filingsService.create).not.toHaveBeenCalled();
    });

    it('I6: includes deactivated registrations for periods that started on or before deactivatedAt; skips later periods', async () => {
      // Registration deactivated on 2026-04-15. Per Q8:
      //   - period starting 2026-04-01 (before deactivation) → generate
      //   - period starting 2026-05-01 (after deactivation) → skip
      ruleService.findById.mockResolvedValue(makeRule());
      registrationService.getRegistrationsForLaw.mockResolvedValue([
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

      await service.generateForRule('r1');

      expect(filingsService.create).toHaveBeenCalledTimes(1);
      expect(filingsService.create.mock.calls[0]![0]).toMatchObject({ periodStart: '2026-04-01' });
    });

    it('I6: skips every period when deactivatedAt is before the horizon (all periods fall after)', async () => {
      ruleService.findById.mockResolvedValue(makeRule());
      registrationService.getRegistrationsForLaw.mockResolvedValue([
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

      await service.generateForRule('r1');

      expect(filingsService.create).not.toHaveBeenCalled();
    });

    it('swallows the (rule_id, client_id, period_start) unique violation as a concurrent-path race', async () => {
      // The cron run and a J3/J4/J5 listener can race: both pass the
      // findByRuleClientPeriod check, both INSERT, the loser hits the
      // unique index. Treat that loser as a no-op — the winner's row is
      // already in place and its event already fired.
      ruleService.findById.mockResolvedValue(makeRule());
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);
      const raceError = Object.assign(new Error('Failed query: insert into compliance_filings'), {
        cause: Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'compliance_filings_rule_client_period_key',
        }),
      });
      filingsService.create.mockRejectedValueOnce(raceError);

      const result = await service.generateForRule('r1');

      expect(result.created).toBe(0);
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('re-throws unique violations on other constraints — those are real bugs, not races', async () => {
      ruleService.findById.mockResolvedValue(makeRule());
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);
      const otherUniqueError = Object.assign(new Error('Failed query'), {
        cause: Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'compliance_filings_external_key_unique',
        }),
      });
      filingsService.create.mockRejectedValueOnce(otherUniqueError);

      await expect(service.generateForRule('r1')).rejects.toBe(otherUniqueError);
    });

    it('re-throws non-unique-violation errors (FK, NULL, etc.)', async () => {
      ruleService.findById.mockResolvedValue(makeRule());
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);
      const fkError = Object.assign(new Error('Failed query'), {
        cause: Object.assign(new Error('FK violation'), {
          code: '23503',
          constraint: 'compliance_filings_assignee_team_id_org_units_id_fk',
        }),
      });
      filingsService.create.mockRejectedValueOnce(fkError);

      await expect(service.generateForRule('r1')).rejects.toBe(fkError);
    });

    it('repeat firings do not create duplicates — natural-key guard protects retries', async () => {
      const rule = makeRule();
      ruleService.findById.mockResolvedValue(rule);
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);

      filingsService.findExistingKeys.mockResolvedValueOnce(new Set<string>());
      await service.generateForRule('r1');
      expect(filingsService.create).toHaveBeenCalledTimes(1);

      filingsService.findExistingKeys.mockResolvedValueOnce(new Set(['c1:2026-04-01']));
      await service.generateForRule('r1');
      expect(filingsService.create).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // generateForRegistration — J4 entrypoint.
  // ---------------------------------------------------------------------------

  describe('generateForRegistration', () => {
    it('no-ops when no active registration for (clientId, lawId)', async () => {
      registrationService.getRegistrationsForLaw.mockResolvedValue([]);

      const result = await service.generateForRegistration('c1', 'l1');

      expect(result.created).toBe(0);
      expect(filingsService.create).not.toHaveBeenCalled();
    });

    it('skips deactivated registration even if returned by getRegistrationsForLaw', async () => {
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        {
          id: 'reg1',
          clientId: 'c1',
          lawId: 'l1',
          registeredAt: utc(2025, 1, 1),
          deactivatedAt: utc(2026, 1, 1),
        },
      ]);

      const result = await service.generateForRegistration('c1', 'l1');

      expect(result.created).toBe(0);
      expect(ruleService.findActive).not.toHaveBeenCalled();
    });

    it('generates for active rules on the law against the new registration only', async () => {
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
        { id: 'reg2', clientId: 'c2', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.findActive.mockResolvedValue([
        makeRule({ id: 'r1', lawId: 'l1', status: 'active' }),
        makeRule({ id: 'r2', lawId: 'l1', status: 'draft' }), // ignored — not active
        makeRule({ id: 'r3', lawId: 'l-other', status: 'active' }), // ignored — different law
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);

      await service.generateForRegistration('c1', 'l1');

      // One filing for r1 × c1 only — c2 is unrelated to this trigger.
      expect(filingsService.create).toHaveBeenCalledTimes(1);
      expect(filingsService.create.mock.calls[0]![0]).toMatchObject({
        ruleId: 'r1',
        clientId: 'c1',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // generateForClient — J5 entrypoint.
  // ---------------------------------------------------------------------------

  describe('generateForClient', () => {
    it('no-ops when client has no active registrations', async () => {
      registrationService.getRegisteredLaws.mockResolvedValue([]);

      const result = await service.generateForClient('c1');

      expect(result.created).toBe(0);
      expect(ruleService.findActive).not.toHaveBeenCalled();
    });

    it('iterates every (active registration × active rule on its law) for the client', async () => {
      registrationService.getRegisteredLaws.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
        { id: 'reg2', clientId: 'c1', lawId: 'l2', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.findActive.mockResolvedValue([
        makeRule({ id: 'r1', lawId: 'l1', status: 'active' }),
        makeRule({ id: 'r2', lawId: 'l2', status: 'active' }),
        makeRule({ id: 'r3', lawId: 'l1', status: 'deprecated' }), // ignored — deprecated
        makeRule({ id: 'r4', lawId: 'l3', status: 'active' }), // ignored — client not on l3
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
      ]);

      await service.generateForClient('c1');

      expect(filingsService.create).toHaveBeenCalledTimes(2);
      const ruleIdsCreated = filingsService.create.mock.calls.map((c) => c[0].ruleId);
      expect(ruleIdsCreated.sort()).toEqual(['r1', 'r2']);
    });
  });

  // ---------------------------------------------------------------------------
  // Q6 race guard — the inner per-occurrence client-status check.
  // Async generator paths (J4 registration-created, in particular) snapshot
  // the registration list at entry. If the client transitions to dormant
  // mid-flight, the dormancy cascade only cancels filings that exist at
  // transition time; without an inner check the loop keeps creating fresh
  // pending rows for the now-dormant client. The check stops the loop the
  // moment the next iteration sees the new status.
  // ---------------------------------------------------------------------------

  describe('Q6 race guard: client transitions to dormant mid-flight', () => {
    it('stops creating filings the moment the client is no longer active', async () => {
      ruleService.findActive.mockResolvedValue([
        makeRule({ id: 'r1', lawId: 'l1', status: 'active' }),
      ]);
      registrationService.getRegistrationsForLaw.mockResolvedValue([
        { id: 'reg1', clientId: 'c1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);
      ruleService.expandRule.mockReturnValue([
        { periodStart: utc(2026, 4, 1), periodEnd: utc(2026, 4, 30), dueDate: utc(2026, 5, 20) },
        { periodStart: utc(2026, 5, 1), periodEnd: utc(2026, 5, 31), dueDate: utc(2026, 6, 20) },
        { periodStart: utc(2026, 6, 1), periodEnd: utc(2026, 6, 30), dueDate: utc(2026, 7, 20) },
      ]);
      // Active for the first occurrence, dormant from the second onwards.
      registrationService.isClientActive
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false);

      await service.generateForRegistration('c1', 'l1');

      expect(filingsService.create).toHaveBeenCalledTimes(1);
    });
  });
});
