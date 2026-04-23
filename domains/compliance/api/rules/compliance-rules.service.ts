import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService, eq, ne } from '@packages/database';
import { FREQUENCIES, type ComplianceFrequency } from '@domains/compliance-contract';
import { complianceRules } from '../schema/rules';
import { complianceLawHandlers } from '../schema/law-handlers';
import { LawHandlerService } from '../law-handlers/law-handlers.service';

export class InvalidFrequencyError extends BadRequestException {
  constructor(value: string) {
    super({
      code: 'INVALID_FREQUENCY',
      message: `Invalid frequency "${value}". Must be one of: ${FREQUENCIES.join(', ')}`,
    });
  }
}

function assertFrequency(value: string): asserts value is ComplianceFrequency {
  if (!(FREQUENCIES as readonly string[]).includes(value)) {
    throw new InvalidFrequencyError(value);
  }
}

export type ComplianceRuleStatus = 'draft' | 'active' | 'deprecated';

export interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  lawId: string;
  frequency: ComplianceFrequency;
  status: ComplianceRuleStatus;
  dueDayOfMonth: number;
  dueMonthOffset: number;
  gracePeriodDays: number;
  description: string | null;
}

export interface CreateComplianceRuleInput {
  code: string;
  name: string;
  lawId: string;
  frequency: ComplianceFrequency;
  status?: ComplianceRuleStatus;
  dueDayOfMonth: number;
  dueMonthOffset?: number;
  gracePeriodDays?: number;
  description?: string | null;
}

export interface Occurrence {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
}

export class NoDefaultHandlerError extends BadRequestException {
  constructor(lawId: string) {
    super({ code: 'NO_DEFAULT_HANDLER', message: `Law ${lawId} has no default handler` });
  }
}

export class AmbiguousHandlerError extends BadRequestException {
  constructor(lawId: string, clientId: string, tier: string) {
    super({
      code: 'AMBIGUOUS_HANDLER',
      message: `Multiple handlers matched at tier "${tier}" for law ${lawId} client ${clientId}`,
    });
  }
}

/**
 * Build a UTC date from Y/M/D without locale drift. Month is 1-indexed.
 * Clamps day to the last day of the month if day > daysInMonth.
 */
function utcDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return new Date(Date.UTC(year, month - 1, clampedDay));
}

function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const total = (year * 12 + (month - 1)) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

@Injectable()
export class ComplianceRuleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly lawHandlers: LawHandlerService,
  ) {}

  async create(input: CreateComplianceRuleInput): Promise<ComplianceRule> {
    assertFrequency(input.frequency);
    const hasHandler = await this.lawHandlers.hasDefaultHandler(input.lawId);
    if (!hasHandler) {
      throw new NoDefaultHandlerError(input.lawId);
    }
    const [row] = await this.database.db
      .insert(complianceRules)
      .values({
        code: input.code,
        name: input.name,
        lawId: input.lawId,
        frequency: input.frequency,
        status: input.status ?? 'draft',
        dueDayOfMonth: input.dueDayOfMonth,
        dueMonthOffset: input.dueMonthOffset ?? 0,
        gracePeriodDays: input.gracePeriodDays ?? 0,
        description: input.description ?? null,
      })
      .returning();
    return this.toRule(row);
  }

  async findActive(): Promise<ComplianceRule[]> {
    const rows = await this.database.db
      .select()
      .from(complianceRules)
      .where(ne(complianceRules.status, 'deprecated'));
    return rows.map((r) => this.toRule(r));
  }

  async findById(id: string): Promise<ComplianceRule | null> {
    const rows = await this.database.db
      .select()
      .from(complianceRules)
      .where(eq(complianceRules.id, id));
    return rows[0] ? this.toRule(rows[0]) : null;
  }

  /**
   * Expand a rule into filing occurrences whose period ends between `from` and `to`.
   * The "period" is the reporting window being filed for, NOT the filing deadline.
   *
   * Period granularity per frequency:
   * - monthly       → calendar month
   * - quarterly     → Jan-Mar / Apr-Jun / Jul-Sep / Oct-Dec
   * - half_yearly   → Jan-Jun / Jul-Dec
   * - yearly        → Apr Y..Mar Y+1 (Indian Financial Year)
   *
   * Due date = periodEnd + dueMonthOffset months → dueDayOfMonth of resulting month.
   * Grace period days are stored on the rule but not added to dueDate — consumers
   * can use them for notification lead time.
   */
  expandRule(rule: ComplianceRule, from: Date, to: Date): Occurrence[] {
    const periods = this.enumeratePeriods(rule.frequency, from, to);
    return periods.map((p) => ({
      periodStart: p.start,
      periodEnd: p.end,
      dueDate: this.computeDueDate(p.end, rule.dueMonthOffset, rule.dueDayOfMonth),
    }));
  }

  /**
   * Strict 4-tier handler resolution. Throws if ambiguous at any tier.
   * No fallback to unassigned — missing global handler is caller's bug (guarded at create time).
   */
  async resolveAssignee(lawId: string, clientId: string): Promise<string> {
    const allRows = await this.database.db
      .select()
      .from(complianceLawHandlers)
      .where(eq(complianceLawHandlers.lawId, lawId));

    const clientRows = allRows.filter((r) => r.clientId === clientId);
    const clientPrimary = clientRows.filter((r) => r.isPrimary);
    if (clientPrimary.length === 1) return clientPrimary[0]!.orgEntityId;
    if (clientPrimary.length > 1) {
      throw new AmbiguousHandlerError(lawId, clientId, 'client-primary');
    }
    if (clientRows.length === 1) return clientRows[0]!.orgEntityId;
    if (clientRows.length > 1) {
      throw new AmbiguousHandlerError(lawId, clientId, 'client-any');
    }

    const globalRows = allRows.filter((r) => r.clientId === null);
    const globalPrimary = globalRows.filter((r) => r.isPrimary);
    if (globalPrimary.length === 1) return globalPrimary[0]!.orgEntityId;
    if (globalPrimary.length > 1) {
      throw new AmbiguousHandlerError(lawId, clientId, 'global-primary');
    }
    if (globalRows.length === 1) return globalRows[0]!.orgEntityId;
    if (globalRows.length > 1) {
      throw new AmbiguousHandlerError(lawId, clientId, 'global-any');
    }

    throw new NoDefaultHandlerError(lawId);
  }

  // -------------------------------------------------------------------------
  // Period enumeration
  // -------------------------------------------------------------------------

  private enumeratePeriods(
    frequency: ComplianceFrequency,
    from: Date,
    to: Date,
  ): { start: Date; end: Date }[] {
    const out: { start: Date; end: Date }[] = [];
    // Iterate starting from a safe earlier anchor (1 year before `from`) so
    // an in-progress period whose end falls inside the window is not missed.
    const anchorYear = from.getUTCFullYear() - 1;
    const endCap = to;

    if (frequency === 'monthly') {
      for (let y = anchorYear; y <= endCap.getUTCFullYear() + 1; y++) {
        for (let m = 1; m <= 12; m++) {
          const start = utcDate(y, m, 1);
          const end = utcDate(y, m + 1, 0); // last day of month m
          if (end > endCap) return out;
          if (end >= from) out.push({ start, end });
        }
      }
    } else if (frequency === 'quarterly') {
      const quarterStarts = [1, 4, 7, 10];
      for (let y = anchorYear; y <= endCap.getUTCFullYear() + 1; y++) {
        for (const qm of quarterStarts) {
          const start = utcDate(y, qm, 1);
          const end = utcDate(y, qm + 3, 0);
          if (end > endCap) return out;
          if (end >= from) out.push({ start, end });
        }
      }
    } else if (frequency === 'half_yearly') {
      for (let y = anchorYear; y <= endCap.getUTCFullYear() + 1; y++) {
        for (const sm of [1, 7]) {
          const start = utcDate(y, sm, 1);
          const end = utcDate(y, sm + 6, 0);
          if (end > endCap) return out;
          if (end >= from) out.push({ start, end });
        }
      }
    } else if (frequency === 'yearly') {
      // Indian Financial Year: Apr Y .. Mar Y+1
      for (let y = anchorYear; y <= endCap.getUTCFullYear() + 1; y++) {
        const start = utcDate(y, 4, 1);
        const end = utcDate(y + 1, 3, 31);
        if (end > endCap) return out;
        if (end >= from) out.push({ start, end });
      }
    }
    return out;
  }

  private computeDueDate(periodEnd: Date, offsetMonths: number, dueDay: number): Date {
    const baseYear = periodEnd.getUTCFullYear();
    const baseMonth = periodEnd.getUTCMonth() + 1;
    const { year, month } = addMonths(baseYear, baseMonth, offsetMonths);
    return utcDate(year, month, dueDay);
  }

  private toRule(row: typeof complianceRules.$inferSelect): ComplianceRule {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      lawId: row.lawId,
      frequency: row.frequency,
      status: row.status as ComplianceRuleStatus,
      dueDayOfMonth: row.dueDayOfMonth,
      dueMonthOffset: row.dueMonthOffset,
      gracePeriodDays: row.gracePeriodDays,
      description: row.description,
    };
  }
}
