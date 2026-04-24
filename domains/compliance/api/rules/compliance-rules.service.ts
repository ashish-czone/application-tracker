import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService, and, count, eq, inArray, ne, not } from '@packages/database';
import { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { FREQUENCIES, type ComplianceFrequency } from '@domains/compliance-contract';
import { complianceRules } from '../schema/rules';
import { complianceLawHandlers } from '../schema/law-handlers';
import { complianceFilings } from '../schema/compliance-filings';
import { LawHandlerService } from '../law-handlers/law-handlers.service';
import { ComplianceFilingsCancellationService } from '../compliance-filings/compliance-filings-cancellation.service';

const RULE_WORKFLOW_SLUG = 'compliance-rule-status';
const TERMINAL_FILING_STATUSES = ['completed', 'cancelled'];

/**
 * Reason written to workflow_transition_history for filings cancelled as a
 * consequence of their rule being deprecated. Single reason — unlike
 * registration deactivation, there's no pre/post-effective split here because
 * deprecation doesn't carry an effective date. Either the admin opts in to
 * cancel all in-flight filings or the cascade is a no-op.
 */
const REASON_RULE_DEPRECATED = 'Rule deprecated';

export class InvalidFrequencyError extends BadRequestException {
  constructor(value: string) {
    super({
      code: 'INVALID_FREQUENCY',
      message: `Invalid frequency "${value}". Must be one of: ${FREQUENCIES.join(', ')}`,
    });
  }
}

/**
 * I14: raised by the rule update guard when the caller tries to change a
 * rule-identity field (`code`, `frequency`, `lawId`) on a rule that has
 * already materialised at least one filing. The UI uses `fields` to mark the
 * offending inputs; message is the human-readable one-liner.
 *
 * Forward-only fields (`dueDayOfMonth`, `dueMonthOffset`, `gracePeriodDays`)
 * stay editable — they never raise this error. See Q9 for the per-field
 * policy that defines which fields are identity vs forward-only.
 */
export const IMMUTABLE_RULE_IDENTITY_FIELDS = ['code', 'frequency', 'lawId'] as const;
export type ImmutableRuleIdentityField = (typeof IMMUTABLE_RULE_IDENTITY_FIELDS)[number];

export class ImmutableRuleFieldError extends BadRequestException {
  constructor(fields: ImmutableRuleIdentityField[]) {
    const list = fields.join(', ');
    super({
      code: 'RULE_FIELD_IMMUTABLE',
      message:
        `Cannot change ${list}: this rule has generated filings. ` +
        `Deprecate this rule and create a new one to change identity fields.`,
      fields,
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

export interface DeprecationPreview {
  ruleId: string;
  inFlightFilingCount: number;
}

export interface DeprecationResult {
  ruleId: string;
  cancelledFilingIds: string[];
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
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly lawHandlers: LawHandlerService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
    private readonly filingsCancellation: ComplianceFilingsCancellationService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ComplianceRuleService.name);
  }

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

  /**
   * Domain update path used by the compliance-rules custom controller. Runs
   * the I14 guard, writes allowed fields, and returns the fresh row.
   *
   * Status is excluded — workflow transitions flow through the workflow
   * engine (draft → active → deprecated), not PATCH. `deprecate()` is the
   * dedicated endpoint for deprecation.
   *
   * The same guard is also wired as a `beforeUpdate` hook on the entity
   * config (defense-in-depth) so callers hitting the generic CRUD path
   * still get the 400. The custom controller is the preferred UI entry
   * point because the UI needs a single mutation to invalidate together.
   */
  async update(
    id: string,
    input: Partial<Pick<CreateComplianceRuleInput, 'code' | 'name' | 'lawId' | 'frequency' | 'dueDayOfMonth' | 'dueMonthOffset' | 'gracePeriodDays' | 'description'>>,
  ): Promise<ComplianceRule> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Rule ${id} not found`);
    }
    if (input.frequency !== undefined) {
      assertFrequency(input.frequency);
    }
    await this.assertUpdateAllowed(id, input as Record<string, unknown>);

    const patch: Record<string, unknown> = {};
    if (input.code !== undefined) patch.code = input.code;
    if (input.name !== undefined) patch.name = input.name;
    if (input.lawId !== undefined) patch.lawId = input.lawId;
    if (input.frequency !== undefined) patch.frequency = input.frequency;
    if (input.dueDayOfMonth !== undefined) patch.dueDayOfMonth = input.dueDayOfMonth;
    if (input.dueMonthOffset !== undefined) patch.dueMonthOffset = input.dueMonthOffset;
    if (input.gracePeriodDays !== undefined) patch.gracePeriodDays = input.gracePeriodDays;
    if (input.description !== undefined) patch.description = input.description;

    if (Object.keys(patch).length === 0) return existing;

    const [row] = await this.database.db
      .update(complianceRules)
      .set(patch)
      .where(eq(complianceRules.id, id))
      .returning();
    return this.toRule(row);
  }

  async findById(id: string): Promise<ComplianceRule | null> {
    const rows = await this.database.db
      .select()
      .from(complianceRules)
      .where(eq(complianceRules.id, id));
    return rows[0] ? this.toRule(rows[0]) : null;
  }

  /**
   * I13: does this rule have at least one filing materialised against it?
   * Used by the I14 update guard to lock identity fields (`code`, `frequency`,
   * `lawId`) and by the I15 UI to render forward-only copy on due-date math
   * edits. Single-row existence check — `LIMIT 1`, no full count scan.
   *
   * Cancelled filings count: once a filing has been generated, the rule's
   * identity is baked into historical data. Whether the filing is still open,
   * completed, or cancelled is irrelevant — renaming the rule would still
   * rewrite what those rows mean.
   */
  async hasGeneratedFilings(ruleId: string): Promise<boolean> {
    const rows = await this.database.db
      .select({ id: complianceFilings.id })
      .from(complianceFilings)
      .where(eq(complianceFilings.ruleId, ruleId))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * I13 + I15: what the edit form needs to know before rendering. Boolean +
   * count pair — the boolean drives the identity-field disable state; the
   * count is displayed in the forward-only save dialog ("N filings already
   * generated will keep their current due dates").
   */
  async getEditConstraints(ruleId: string): Promise<{
    ruleId: string;
    hasGeneratedFilings: boolean;
    generatedFilingCount: number;
  }> {
    const rule = await this.findById(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    const [row] = await this.database.db
      .select({ count: count() })
      .from(complianceFilings)
      .where(eq(complianceFilings.ruleId, ruleId));
    const generatedFilingCount = Number(row?.count ?? 0);
    return {
      ruleId,
      hasGeneratedFilings: generatedFilingCount > 0,
      generatedFilingCount,
    };
  }

  /**
   * I14: guard invoked from the `beforeUpdate` hook on `COMPLIANCE_RULES_CONFIG`.
   * When the payload touches an identity field (`code`, `frequency`, `lawId`)
   * AND the rule already has filings AND the new value is actually different
   * from the current value, throw ImmutableRuleFieldError. Same-value writes
   * pass through so idempotent PATCHes don't 400 spuriously.
   *
   * Forward-only fields (`dueDayOfMonth`, `dueMonthOffset`, `gracePeriodDays`)
   * are explicitly allowed by this guard — Q9 keeps them editable and relies
   * on the generator being a pure no-op on conflict (I16) to hold the
   * forward-only invariant without needing a server-side shift.
   */
  async assertUpdateAllowed(id: string, payload: Record<string, unknown>): Promise<void> {
    const touched = IMMUTABLE_RULE_IDENTITY_FIELDS.filter((k) => k in payload);
    if (touched.length === 0) return;

    const current = await this.findById(id);
    if (!current) {
      // Let the underlying update raise NotFoundException — this guard only
      // polices field-level immutability, not existence.
      return;
    }

    const changed = touched.filter((k) => payload[k] !== undefined && payload[k] !== current[k]);
    if (changed.length === 0) return;

    const hasFilings = await this.hasGeneratedFilings(id);
    if (!hasFilings) return;

    throw new ImmutableRuleFieldError(changed);
  }

  /**
   * Dry-run of deprecation for the UI dialog (I10). Returns the count of
   * non-terminal filings for this rule across all clients. No writes.
   * Feeds the "Also cancel N in-flight filings from this rule" checkbox —
   * when the count is zero we hide the checkbox entirely on the UI.
   */
  async previewDeprecation(ruleId: string): Promise<DeprecationPreview> {
    const rule = await this.findById(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    const [row] = await this.database.db
      .select({ count: count() })
      .from(complianceFilings)
      .where(and(
        eq(complianceFilings.ruleId, ruleId),
        not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
      ));
    return {
      ruleId,
      inFlightFilingCount: Number(row?.count ?? 0),
    };
  }

  /**
   * Deprecate a rule (I8-I10). Semantics are the softest of the three
   * lifecycle cascades in this stream:
   *
   *   - Flips `compliance_rules.status` to 'deprecated' and writes one
   *     `workflow_transition_history` row for the rule itself (captures
   *     actor, reason, comment). Generator (I9) short-circuits on
   *     `status === 'deprecated'`, so no new filings will be produced.
   *   - Existing non-terminal filings are preserved by default. If the admin
   *     opts in via `alsoCancelInFlight`, every non-terminal filing for this
   *     rule is cancelled inside the same tx, each with its own
   *     workflow_transition_history row (reason: "Rule deprecated").
   *   - No domain-specific event emitted — the rule's own transition row
   *     plus the per-filing cancellation rows are the authoritative audit.
   *
   * All of the above runs in one tx — the rule status flip and every filing
   * cancellation succeed or fail together. Idempotent on already-deprecated
   * rules (no-ops and returns an empty list).
   */
  async deprecate(
    ruleId: string,
    params: {
      alsoCancelInFlight?: boolean;
      actorId: string | null;
      comment?: string;
    },
  ): Promise<DeprecationResult> {
    const rule = await this.findById(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    if (rule.status === 'deprecated') {
      return { ruleId, cancelledFilingIds: [] };
    }

    const definition = this.workflowRegistry.getBySlug(RULE_WORKFLOW_SLUG);
    if (!definition) {
      throw new Error(
        `Workflow definition '${RULE_WORKFLOW_SLUG}' not found — cannot record rule deprecation history`,
      );
    }
    const ruleTransitionId = definition.transitions.find(
      (t) => t.fromStateName === rule.status && t.toStateName === 'deprecated',
    )?.id;
    if (!ruleTransitionId) {
      throw new Error(
        `No configured transition from '${rule.status}' → 'deprecated' on workflow '${RULE_WORKFLOW_SLUG}'.`,
      );
    }

    const alsoCancelInFlight = params.alsoCancelInFlight ?? false;

    const cancelledIds = await this.database.db.transaction(async (tx) => {
      await tx
        .update(complianceRules)
        .set({ status: 'deprecated' })
        .where(eq(complianceRules.id, ruleId));

      await this.workflowEngine.recordHistory({
        workflowDefinitionId: definition.id,
        entityType: 'compliance_rules',
        entityId: ruleId,
        fieldName: 'status',
        fromState: rule.status,
        toState: 'deprecated',
        transitionId: ruleTransitionId,
        actorId: params.actorId,
        reason: REASON_RULE_DEPRECATED,
        comment: params.comment ?? null,
      }, tx);

      if (!alsoCancelInFlight) return [];

      const inFlight = await tx
        .select({ id: complianceFilings.id, status: complianceFilings.status })
        .from(complianceFilings)
        .where(and(
          eq(complianceFilings.ruleId, ruleId),
          not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
        ));

      await this.filingsCancellation.cancelFilings(tx, inFlight, {
        reason: REASON_RULE_DEPRECATED,
        comment: this.buildCascadeComment(rule.code, params.comment),
        actorId: params.actorId,
      });

      return inFlight.map((f: { id: string }) => f.id);
    });

    this.logger.log('Rule deprecated', {
      ruleId,
      ruleCode: rule.code,
      cancelledCount: cancelledIds.length,
      alsoCancelInFlight,
    });

    return { ruleId, cancelledFilingIds: cancelledIds };
  }

  private buildCascadeComment(ruleCode: string, adminComment: string | undefined): string {
    const prefix = `Auto-cancelled: rule "${ruleCode}" deprecated.`;
    return adminComment ? `${prefix} ${adminComment}` : prefix;
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
