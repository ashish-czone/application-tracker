import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import {
  ComplianceRulesService,
  NoDefaultHandlerError,
  AmbiguousHandlerError,
  InvalidFrequencyError,
  ImmutableRuleFieldError,
  LawHandlerRequiredError,
  type ComplianceRule,
} from '../compliance-rules.service';
import type { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import type { AppLoggerService } from '@packages/logger';
import type { ComplianceFilingsCancellationService } from '../../compliance-filings/compliance-filings-cancellation.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockSelectRows(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockSelectRowsWithLimit(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockInsertReturning(row: unknown) {
  const chain: AnyChain = {} as AnyChain;
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([row]);
  return chain;
}

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function makeRule(overrides: Partial<ComplianceRule> = {}): ComplianceRule {
  return {
    id: 'r1',
    code: 'TEST-RULE',
    name: 'Test Rule',
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

describe('ComplianceRulesService', () => {
  let entityService: {
    list: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    clone: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    getListLayout: ReturnType<typeof vi.fn>;
  };
  let db: { db: Record<string, ReturnType<typeof vi.fn>> };
  let lawHandlers: { hasDefaultHandler: ReturnType<typeof vi.fn> };
  let workflowEngine: { recordHistory: ReturnType<typeof vi.fn> };
  let workflowRegistry: { getBySlug: ReturnType<typeof vi.fn> };
  let filingsCancellation: { cancelFilings: ReturnType<typeof vi.fn> };
  let service: ComplianceRulesService;

  const ruleWorkflowDef = {
    id: 'wf-def-rule-status',
    transitions: [
      { id: 't-draft-deprecated', fromStateName: 'draft', toStateName: 'deprecated' },
      { id: 't-active-deprecated', fromStateName: 'active', toStateName: 'deprecated' },
      { id: 't-deprecated-active', fromStateName: 'deprecated', toStateName: 'active' },
    ],
  };

  const appLogger = {
    forContext: vi.fn().mockReturnValue({
      log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    }),
  } as unknown as AppLoggerService;

  beforeEach(() => {
    entityService = {
      list: vi.fn(),
      findOneOrFail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      clone: vi.fn(),
      restore: vi.fn(),
      getListLayout: vi.fn(),
    };
    db = {
      db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        transaction: vi.fn(),
      },
    };
    lawHandlers = { hasDefaultHandler: vi.fn() };
    workflowEngine = { recordHistory: vi.fn().mockResolvedValue({ historyId: 'h', recordedAt: '' }) };
    workflowRegistry = { getBySlug: vi.fn().mockReturnValue(ruleWorkflowDef) };
    filingsCancellation = { cancelFilings: vi.fn().mockResolvedValue(undefined) };
    service = new ComplianceRulesService(
      entityService as never,
      db as never,
      lawHandlers as never,
      workflowEngine as unknown as WorkflowEngineService,
      workflowRegistry as unknown as WorkflowRegistryService,
      filingsCancellation as unknown as ComplianceFilingsCancellationService,
      appLogger,
    );
  });

  // --------------------------------------------------------------------------
  // create guard
  // --------------------------------------------------------------------------

  describe('create', () => {
    it('throws NoDefaultHandlerError when the law has no global handler', async () => {
      lawHandlers.hasDefaultHandler.mockResolvedValue(false);
      await expect(
        service.create(
          { code: 'X', name: 'x', lawId: 'l1', frequency: 'monthly', dueDayOfMonth: 20 } as never,
          'u1',
        ),
      ).rejects.toBeInstanceOf(NoDefaultHandlerError);
      expect(entityService.create).not.toHaveBeenCalled();
    });

    it('throws InvalidFrequencyError when frequency is not in the FREQUENCIES enum', async () => {
      lawHandlers.hasDefaultHandler.mockResolvedValue(true);
      await expect(
        service.create(
          {
            code: 'X',
            name: 'x',
            lawId: 'l1',
            frequency: 'biweekly',
            dueDayOfMonth: 20,
          } as never,
          'u1',
        ),
      ).rejects.toBeInstanceOf(InvalidFrequencyError);
      expect(entityService.create).not.toHaveBeenCalled();
      expect(lawHandlers.hasDefaultHandler).not.toHaveBeenCalled();
    });

    it('delegates to entityService.create when a default handler exists', async () => {
      lawHandlers.hasDefaultHandler.mockResolvedValue(true);
      entityService.create.mockResolvedValue({ id: 'r1', code: 'X', status: 'draft' });

      const result = await service.create(
        { code: 'X', name: 'x', lawId: 'l1', frequency: 'monthly', dueDayOfMonth: 20, dueMonthOffset: 1 } as never,
        'u1',
      );

      expect(entityService.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'X', lawId: 'l1', frequency: 'monthly' }),
        'u1',
      );
      expect((result as { id: string }).id).toBe('r1');
    });
  });

  // --------------------------------------------------------------------------
  // expandRule — per frequency
  // --------------------------------------------------------------------------

  describe('expandRule - monthly', () => {
    it('returns monthly occurrences for the window with correct dueDate', () => {
      const rule = makeRule({ frequency: 'monthly', dueDayOfMonth: 20, dueMonthOffset: 1 });
      const out = service.expandRule(rule, utc(2026, 4, 1), utc(2026, 6, 30));

      expect(out).toHaveLength(3);
      expect(out[0]).toEqual({
        periodStart: utc(2026, 4, 1),
        periodEnd: utc(2026, 4, 30),
        dueDate: utc(2026, 5, 20),
      });
      expect(out[1]).toEqual({
        periodStart: utc(2026, 5, 1),
        periodEnd: utc(2026, 5, 31),
        dueDate: utc(2026, 6, 20),
      });
      expect(out[2]).toEqual({
        periodStart: utc(2026, 6, 1),
        periodEnd: utc(2026, 6, 30),
        dueDate: utc(2026, 7, 20),
      });
    });

    it('clamps dueDay to last day of short months', () => {
      // February due on the 31st → should clamp to 28 (or 29 in leap year).
      // Set rule so periodEnd is January and offset=1 lands the due in Feb.
      const rule = makeRule({ frequency: 'monthly', dueDayOfMonth: 31, dueMonthOffset: 1 });
      const out = service.expandRule(rule, utc(2027, 1, 1), utc(2027, 1, 31));

      expect(out).toHaveLength(1);
      expect(out[0]?.dueDate).toEqual(utc(2027, 2, 28));
    });

    it('clamps correctly to Feb 29 in a leap year', () => {
      const rule = makeRule({ frequency: 'monthly', dueDayOfMonth: 31, dueMonthOffset: 1 });
      const out = service.expandRule(rule, utc(2028, 1, 1), utc(2028, 1, 31));

      expect(out).toHaveLength(1);
      expect(out[0]?.dueDate).toEqual(utc(2028, 2, 29));
    });
  });

  describe('expandRule - quarterly', () => {
    it('returns quarterly occurrences with GST-style dueDate', () => {
      // Q1 2026 = Jan-Mar, due Apr 11
      const rule = makeRule({ frequency: 'quarterly', dueDayOfMonth: 11, dueMonthOffset: 1 });
      const out = service.expandRule(rule, utc(2026, 1, 1), utc(2026, 12, 31));

      expect(out).toHaveLength(4);
      expect(out[0]).toEqual({
        periodStart: utc(2026, 1, 1),
        periodEnd: utc(2026, 3, 31),
        dueDate: utc(2026, 4, 11),
      });
      expect(out[3]).toEqual({
        periodStart: utc(2026, 10, 1),
        periodEnd: utc(2026, 12, 31),
        dueDate: utc(2027, 1, 11),
      });
    });
  });

  describe('expandRule - half_yearly', () => {
    it('returns H1 and H2 with dueDate rolling over the year boundary', () => {
      const rule = makeRule({ frequency: 'half_yearly', dueDayOfMonth: 15, dueMonthOffset: 1 });
      const out = service.expandRule(rule, utc(2026, 1, 1), utc(2026, 12, 31));

      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({
        periodStart: utc(2026, 1, 1),
        periodEnd: utc(2026, 6, 30),
        dueDate: utc(2026, 7, 15),
      });
      expect(out[1]).toEqual({
        periodStart: utc(2026, 7, 1),
        periodEnd: utc(2026, 12, 31),
        dueDate: utc(2027, 1, 15),
      });
    });
  });

  describe('expandRule - yearly (Indian FY)', () => {
    it('returns Apr-Mar period with dueDate 4 months after period end', () => {
      // FY 2026-27 → Apr 1 2026 .. Mar 31 2027, due Jul 31 2027
      const rule = makeRule({ frequency: 'yearly', dueDayOfMonth: 31, dueMonthOffset: 4 });
      const out = service.expandRule(rule, utc(2026, 4, 1), utc(2027, 7, 31));

      const fy2627 = out.find(
        (o) => o.periodStart.toISOString().startsWith('2026-04-01'),
      );
      expect(fy2627).toBeDefined();
      expect(fy2627!.periodEnd).toEqual(utc(2027, 3, 31));
      expect(fy2627!.dueDate).toEqual(utc(2027, 7, 31));
    });
  });

  describe('expandRule - window filtering', () => {
    it('excludes periods whose end falls after `to`', () => {
      const rule = makeRule({ frequency: 'monthly', dueDayOfMonth: 10, dueMonthOffset: 1 });
      const out = service.expandRule(rule, utc(2026, 4, 1), utc(2026, 4, 30));
      expect(out).toHaveLength(1);
      expect(out[0]?.periodEnd).toEqual(utc(2026, 4, 30));
    });

    it('includes a period whose end is exactly at `from`', () => {
      const rule = makeRule({ frequency: 'monthly', dueDayOfMonth: 10, dueMonthOffset: 1 });
      const out = service.expandRule(rule, utc(2026, 4, 30), utc(2026, 5, 31));
      expect(out.some((o) => o.periodEnd.toISOString() === utc(2026, 4, 30).toISOString())).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // resolveAssignee — 4-tier strict lookup
  // --------------------------------------------------------------------------

  describe('resolveAssignee', () => {
    const base = { id: 'h?', lawId: 'l1', isPrimary: false };

    it('returns client-specific primary when exactly one exists', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-client-primary', clientId: 'c1', isPrimary: true },
        { ...base, id: 'h2', orgEntityId: 'org-client-other', clientId: 'c1' },
        { ...base, id: 'h3', orgEntityId: 'org-global', clientId: null, isPrimary: true },
      ]));
      expect(await service.resolveAssignee('l1', 'c1')).toBe('org-client-primary');
    });

    it('falls back to client-specific any when no client primary', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-client', clientId: 'c1' },
        { ...base, id: 'h2', orgEntityId: 'org-global', clientId: null, isPrimary: true },
      ]));
      expect(await service.resolveAssignee('l1', 'c1')).toBe('org-client');
    });

    it('throws AmbiguousHandlerError when two client-any handlers exist', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-a', clientId: 'c1' },
        { ...base, id: 'h2', orgEntityId: 'org-b', clientId: 'c1' },
      ]));
      await expect(service.resolveAssignee('l1', 'c1')).rejects.toBeInstanceOf(AmbiguousHandlerError);
    });

    it('falls back to global primary when no client-level handler', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-global-primary', clientId: null, isPrimary: true },
        { ...base, id: 'h2', orgEntityId: 'org-global-other', clientId: null },
      ]));
      expect(await service.resolveAssignee('l1', 'c1')).toBe('org-global-primary');
    });

    it('falls back to global any when no global primary', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-global', clientId: null },
      ]));
      expect(await service.resolveAssignee('l1', 'c1')).toBe('org-global');
    });

    it('throws AmbiguousHandlerError when two global-any handlers exist', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-a', clientId: null },
        { ...base, id: 'h2', orgEntityId: 'org-b', clientId: null },
      ]));
      await expect(service.resolveAssignee('l1', 'c1')).rejects.toBeInstanceOf(AmbiguousHandlerError);
    });

    it('throws NoDefaultHandlerError when no handlers match at all', async () => {
      db.db.select.mockReturnValue(mockSelectRows([]));
      await expect(service.resolveAssignee('l1', 'c1')).rejects.toBeInstanceOf(NoDefaultHandlerError);
    });
  });

  // --------------------------------------------------------------------------
  // canResolveAssignee — I19
  // --------------------------------------------------------------------------

  describe('canResolveAssignee', () => {
    const base = { id: 'h?', lawId: 'l1', isPrimary: false };

    it('returns true when a global handler exists (no clientId)', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-global', clientId: null, isPrimary: true },
      ]));
      expect(await service.canResolveAssignee('l1')).toBe(true);
    });

    it('returns false when only client-specific handlers exist (no clientId)', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-c1', clientId: 'c1' },
      ]));
      expect(await service.canResolveAssignee('l1')).toBe(false);
    });

    it('returns true when a client-specific handler exists for the given clientId', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-c1', clientId: 'c1' },
      ]));
      expect(await service.canResolveAssignee('l1', 'c1')).toBe(true);
    });

    it('returns false on ambiguity (two competing primaries)', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-a', clientId: null, isPrimary: true },
        { ...base, id: 'h2', orgEntityId: 'org-b', clientId: null, isPrimary: true },
      ]));
      expect(await service.canResolveAssignee('l1')).toBe(false);
    });

    it('returns false when no handlers exist for the law', async () => {
      db.db.select.mockReturnValue(mockSelectRows([]));
      expect(await service.canResolveAssignee('l1', 'c1')).toBe(false);
    });

    it('honours excludeHandlerId — simulates deletion of one handler', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-a', clientId: null, isPrimary: true },
      ]));
      // Without exclusion: resolves cleanly
      expect(await service.canResolveAssignee('l1', 'c1')).toBe(true);
      // Excluding the only handler: nothing left to resolve
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-a', clientId: null, isPrimary: true },
      ]));
      expect(await service.canResolveAssignee('l1', 'c1', 'h1')).toBe(false);
    });

    it('excludeHandlerId leaves remaining handlers in place', async () => {
      db.db.select.mockReturnValue(mockSelectRows([
        { ...base, id: 'h1', orgEntityId: 'org-a', clientId: null, isPrimary: true },
        { ...base, id: 'h2', orgEntityId: 'org-b', clientId: null },
      ]));
      // Excluding h1 leaves h2 (global-any) → resolves
      expect(await service.canResolveAssignee('l1', 'c1', 'h1')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // assertHandlerCanBeDeleted — I21
  // --------------------------------------------------------------------------

  describe('assertHandlerCanBeDeleted', () => {
    const handlerRow = {
      id: 'h1',
      lawId: 'l1',
      orgEntityId: 'org-1',
      clientId: null,
      isPrimary: true,
    };

    it('throws NotFoundException when the handler does not exist', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRowsWithLimit([]));
      await expect(service.assertHandlerCanBeDeleted('h1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('passes when no active registrations reference the law', async () => {
      // 1) handler lookup
      db.db.select.mockReturnValueOnce(mockSelectRowsWithLimit([handlerRow]));
      // 2) active registrations on the law (none)
      db.db.select.mockReturnValueOnce(mockSelectRows([]));
      await expect(service.assertHandlerCanBeDeleted('h1')).resolves.toBeUndefined();
    });

    it('passes when remaining handlers still resolve every active registration', async () => {
      // 1) handler lookup
      db.db.select.mockReturnValueOnce(mockSelectRowsWithLimit([handlerRow]));
      // 2) one active registration on the law
      db.db.select.mockReturnValueOnce(mockSelectRows([{ clientId: 'c1', lawId: 'l1' }]));
      // 3) canResolveAssignee → findResolvedHandler reads handlers excluding h1
      db.db.select.mockReturnValueOnce(mockSelectRows([
        handlerRow,
        { ...handlerRow, id: 'h2', orgEntityId: 'org-2', isPrimary: false },
      ]));
      await expect(service.assertHandlerCanBeDeleted('h1')).resolves.toBeUndefined();
    });

    it('throws LawHandlerRequiredError when the deletion would orphan a registration', async () => {
      // 1) handler lookup
      db.db.select.mockReturnValueOnce(mockSelectRowsWithLimit([handlerRow]));
      // 2) one active registration
      db.db.select.mockReturnValueOnce(mockSelectRows([{ clientId: 'c1', lawId: 'l1' }]));
      // 3) the only handler is h1 — excluding it leaves nothing
      db.db.select.mockReturnValueOnce(mockSelectRows([handlerRow]));

      await expect(service.assertHandlerCanBeDeleted('h1')).rejects.toBeInstanceOf(LawHandlerRequiredError);
    });

    it('reports the affected count correctly for multiple orphaned registrations', async () => {
      // 1) handler lookup
      db.db.select.mockReturnValueOnce(mockSelectRowsWithLimit([handlerRow]));
      // 2) two active registrations
      db.db.select.mockReturnValueOnce(mockSelectRows([
        { clientId: 'c1', lawId: 'l1' },
        { clientId: 'c2', lawId: 'l1' },
      ]));
      // 3) and 4) per-registration resolver lookup — both miss after exclusion
      db.db.select.mockReturnValueOnce(mockSelectRows([handlerRow]));
      db.db.select.mockReturnValueOnce(mockSelectRows([handlerRow]));

      try {
        await service.assertHandlerCanBeDeleted('h1');
        throw new Error('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LawHandlerRequiredError);
        const body = (err as LawHandlerRequiredError & { response?: Record<string, unknown> }).response;
        expect(body?.code).toBe('LAW_HANDLER_REQUIRED');
        expect(body?.affectedRegistrationCount).toBe(2);
      }
    });
  });

  // --------------------------------------------------------------------------
  // hasGeneratedFilings — I13
  // --------------------------------------------------------------------------

  describe('hasGeneratedFilings', () => {
    it('returns true when at least one filing exists for the rule', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRowsWithLimit([{ id: 'f1' }]));
      expect(await service.hasGeneratedFilings('r1')).toBe(true);
    });

    it('returns false when no filings exist for the rule', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRowsWithLimit([]));
      expect(await service.hasGeneratedFilings('r1')).toBe(false);
    });

    it('treats cancelled filings as generated — identity stays baked in', async () => {
      // Even if every filing for this rule is cancelled, the rule has
      // "generated" filings and its identity fields must remain immutable.
      db.db.select.mockReturnValueOnce(mockSelectRowsWithLimit([{ id: 'f-cancelled' }]));
      expect(await service.hasGeneratedFilings('r1')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // getEditConstraints — I15 form hydration
  // --------------------------------------------------------------------------

  describe('getEditConstraints', () => {
    const ruleRow = {
      id: 'r1', code: 'GST-M', name: 'GST', lawId: 'l1', frequency: 'monthly',
      status: 'active',
      dueDayOfMonth: 20, dueMonthOffset: 1, gracePeriodDays: 0, description: null,
    };

    it('returns hasGeneratedFilings=true and the count when filings exist', async () => {
      db.db.select
        .mockReturnValueOnce(mockSelectRows([ruleRow])) // findById
        .mockReturnValueOnce(mockSelectRows([{ count: 12 }])); // count
      expect(await service.getEditConstraints('r1')).toEqual({
        ruleId: 'r1',
        hasGeneratedFilings: true,
        generatedFilingCount: 12,
      });
    });

    it('returns hasGeneratedFilings=false when count is zero', async () => {
      db.db.select
        .mockReturnValueOnce(mockSelectRows([ruleRow]))
        .mockReturnValueOnce(mockSelectRows([{ count: 0 }]));
      expect(await service.getEditConstraints('r1')).toEqual({
        ruleId: 'r1',
        hasGeneratedFilings: false,
        generatedFilingCount: 0,
      });
    });

    it('throws NotFoundException when the rule does not exist', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([]));
      await expect(service.getEditConstraints('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // --------------------------------------------------------------------------
  // assertUpdateAllowed — I14 identity-field guard
  // --------------------------------------------------------------------------

  describe('assertUpdateAllowed', () => {
    const ruleRow = {
      id: 'r1', code: 'GST-M', name: 'GST', lawId: 'l1', frequency: 'monthly',
      status: 'active',
      dueDayOfMonth: 20, dueMonthOffset: 1, gracePeriodDays: 0, description: null,
    };

    it('no-ops when the payload touches no identity field', async () => {
      // Cosmetic + forward-only fields only — no DB access at all.
      await service.assertUpdateAllowed('r1', {
        name: 'New name',
        description: 'Updated',
        dueDayOfMonth: 25,
        dueMonthOffset: 2,
        gracePeriodDays: 3,
      });
      expect(db.db.select).not.toHaveBeenCalled();
    });

    it('passes through when identity fields are in the payload but values match current', async () => {
      // Idempotent PATCH — caller re-sends the same code/frequency/lawId.
      // No filings lookup needed; the guard should short-circuit after
      // discovering no fields actually changed.
      db.db.select.mockReturnValueOnce(mockSelectRows([ruleRow])); // findById
      await service.assertUpdateAllowed('r1', {
        code: 'GST-M',
        frequency: 'monthly',
        lawId: 'l1',
      });
      // only findById was called — no hasGeneratedFilings query
      expect(db.db.select).toHaveBeenCalledTimes(1);
    });

    it('passes through when rule has no generated filings yet', async () => {
      db.db.select
        .mockReturnValueOnce(mockSelectRows([ruleRow])) // findById
        .mockReturnValueOnce(mockSelectRowsWithLimit([])); // hasGeneratedFilings → false
      await service.assertUpdateAllowed('r1', {
        code: 'GST-M-v2',
        frequency: 'quarterly',
      });
    });

    it('throws ImmutableRuleFieldError listing every changed identity field when filings exist', async () => {
      db.db.select
        .mockReturnValueOnce(mockSelectRows([ruleRow])) // findById
        .mockReturnValueOnce(mockSelectRowsWithLimit([{ id: 'f1' }])); // hasGeneratedFilings → true

      await expect(
        service.assertUpdateAllowed('r1', {
          code: 'GST-M-v2',
          frequency: 'quarterly',
          lawId: 'l2',
          name: 'New name',
          dueDayOfMonth: 25,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'RULE_FIELD_IMMUTABLE',
          fields: ['code', 'frequency', 'lawId'],
        }),
      });
    });

    it('reports only the changed identity fields (not the unchanged ones in the payload)', async () => {
      db.db.select
        .mockReturnValueOnce(mockSelectRows([ruleRow]))
        .mockReturnValueOnce(mockSelectRowsWithLimit([{ id: 'f1' }]));

      await expect(
        service.assertUpdateAllowed('r1', {
          code: 'GST-M', // unchanged
          frequency: 'quarterly', // changed
          lawId: 'l1', // unchanged
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          fields: ['frequency'],
        }),
      });
    });

    it('does not throw when only forward-only fields are edited, even with filings', async () => {
      // Due-date math is forward-only, not immutable. Guard must stay out.
      await service.assertUpdateAllowed('r1', {
        dueDayOfMonth: 25,
        dueMonthOffset: 2,
        gracePeriodDays: 5,
      });
      // hasGeneratedFilings must never be queried
      expect(db.db.select).not.toHaveBeenCalled();
    });

    it('ImmutableRuleFieldError is a 400 BadRequestException', async () => {
      const err = new ImmutableRuleFieldError(['code']);
      expect(err.getStatus()).toBe(400);
    });
  });

  // --------------------------------------------------------------------------
  // previewDeprecation — I10 dry-run
  // --------------------------------------------------------------------------

  describe('previewDeprecation', () => {
    const ruleRow = {
      id: 'r1', code: 'GST-M', name: 'GST', lawId: 'l1', frequency: 'monthly',
      status: 'active',
      dueDayOfMonth: 20, dueMonthOffset: 1, gracePeriodDays: 0, description: null,
    };

    it('returns the non-terminal filing count for the rule', async () => {
      db.db.select
        .mockReturnValueOnce(mockSelectRows([ruleRow])) // findById
        .mockReturnValueOnce(mockSelectRows([{ count: 7 }])); // count query

      const result = await service.previewDeprecation('r1');

      expect(result).toEqual({ ruleId: 'r1', inFlightFilingCount: 7 });
    });

    it('returns zero when no in-flight filings exist', async () => {
      db.db.select
        .mockReturnValueOnce(mockSelectRows([ruleRow]))
        .mockReturnValueOnce(mockSelectRows([{ count: 0 }]));

      const result = await service.previewDeprecation('r1');

      expect(result.inFlightFilingCount).toBe(0);
    });

    it('throws NotFoundException when the rule does not exist', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([]));
      await expect(service.previewDeprecation('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // --------------------------------------------------------------------------
  // deprecate — I8/I10
  // --------------------------------------------------------------------------

  describe('deprecate', () => {
    const ruleRow = {
      id: 'r1', code: 'GST-M', name: 'GST', lawId: 'l1', frequency: 'monthly',
      status: 'active',
      dueDayOfMonth: 20, dueMonthOffset: 1, gracePeriodDays: 0, description: null,
    };

    function mockTx(opts: { inFlight?: Array<{ id: string; status: string }> } = {}) {
      const tx: Record<string, ReturnType<typeof vi.fn>> = {} as Record<string, ReturnType<typeof vi.fn>>;
      tx.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
      tx.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(opts.inFlight ?? []),
        }),
      });
      return tx;
    }

    it('throws NotFoundException when rule is missing', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([]));
      await expect(service.deprecate('missing', { actorId: 'u1' })).rejects.toBeInstanceOf(NotFoundException);
      expect(db.db.transaction).not.toHaveBeenCalled();
    });

    it('is a no-op when rule is already deprecated', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([{ ...ruleRow, status: 'deprecated' }]));
      const result = await service.deprecate('r1', { actorId: 'u1' });
      expect(result).toEqual({ ruleId: 'r1', cancelledFilingIds: [] });
      expect(db.db.transaction).not.toHaveBeenCalled();
    });

    it('flips status and writes the rule transition history row; no cascade by default', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([ruleRow]));
      const tx = mockTx();
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const result = await service.deprecate('r1', { actorId: 'u1', comment: 'replaced by GST-M-v2' });

      expect(result.cancelledFilingIds).toEqual([]);
      expect(workflowEngine.recordHistory).toHaveBeenCalledTimes(1);
      expect(workflowEngine.recordHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'compliance-rules',
          entityId: 'r1',
          fromState: 'active',
          toState: 'deprecated',
          transitionId: 't-active-deprecated',
          reason: 'Rule deprecated',
          comment: 'replaced by GST-M-v2',
          actorId: 'u1',
        }),
        tx,
      );
      expect(filingsCancellation.cancelFilings).not.toHaveBeenCalled();
    });

    it('cascades cancellation when alsoCancelInFlight is true', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([ruleRow]));
      const tx = mockTx({
        inFlight: [
          { id: 'f1', status: 'pending' },
          { id: 'f2', status: 'in_progress' },
        ],
      });
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const result = await service.deprecate('r1', { actorId: 'u1', alsoCancelInFlight: true });

      expect(result.cancelledFilingIds).toEqual(['f1', 'f2']);
      expect(filingsCancellation.cancelFilings).toHaveBeenCalledWith(
        tx,
        [
          { id: 'f1', status: 'pending' },
          { id: 'f2', status: 'in_progress' },
        ],
        expect.objectContaining({
          reason: 'Rule deprecated',
          actorId: 'u1',
          comment: expect.stringContaining('GST-M'),
        }),
      );
    });

    it('transitions a draft rule directly to deprecated', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([{ ...ruleRow, status: 'draft' }]));
      const tx = mockTx();
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      await service.deprecate('r1', { actorId: 'u1' });

      expect(workflowEngine.recordHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: 'draft',
          transitionId: 't-draft-deprecated',
        }),
        tx,
      );
    });
  });
});
