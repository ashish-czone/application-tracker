import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ComplianceRuleService,
  NoDefaultHandlerError,
  AmbiguousHandlerError,
  type ComplianceRule,
} from '../compliance-rules.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockSelectRows(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
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
    active: true,
    ...overrides,
  };
}

describe('ComplianceRuleService', () => {
  let db: { db: Record<string, ReturnType<typeof vi.fn>> };
  let lawHandlers: { hasDefaultHandler: ReturnType<typeof vi.fn> };
  let service: ComplianceRuleService;

  beforeEach(() => {
    db = {
      db: {
        select: vi.fn(),
        insert: vi.fn(),
      },
    };
    lawHandlers = { hasDefaultHandler: vi.fn() };
    service = new ComplianceRuleService(db as never, lawHandlers as never);
  });

  // --------------------------------------------------------------------------
  // create guard
  // --------------------------------------------------------------------------

  describe('create', () => {
    it('throws NoDefaultHandlerError when the law has no global handler', async () => {
      lawHandlers.hasDefaultHandler.mockResolvedValue(false);
      await expect(
        service.create({
          code: 'X', name: 'x', lawId: 'l1', frequency: 'monthly', dueDayOfMonth: 20,
        }),
      ).rejects.toBeInstanceOf(NoDefaultHandlerError);
      expect(db.db.insert).not.toHaveBeenCalled();
    });

    it('inserts when a default handler exists', async () => {
      lawHandlers.hasDefaultHandler.mockResolvedValue(true);
      const insertChain = mockInsertReturning({
        id: 'r1', code: 'X', name: 'x', lawId: 'l1', frequency: 'monthly',
        status: 'draft',
        dueDayOfMonth: 20, dueMonthOffset: 1, gracePeriodDays: 0,
        description: null, active: true,
      });
      db.db.insert.mockReturnValue(insertChain);

      const result = await service.create({
        code: 'X', name: 'x', lawId: 'l1', frequency: 'monthly', dueDayOfMonth: 20, dueMonthOffset: 1,
      });

      expect(result.id).toBe('r1');
      expect(result.status).toBe('draft');
      expect(result.active).toBe(true);
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
});
