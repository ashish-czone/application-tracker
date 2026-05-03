import { forwardRef, Inject, Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService, and, count, eq, inArray, isNull, ne, not, sql, withScope } from '@packages/database';
import { type BaseListQuery } from '@packages/entity-engine';
import { BaseCrudService } from '@packages/crud-base';
import { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import { DomainEventEmitter } from '@packages/events';
import type { DataAccessContext } from '@packages/rbac';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { RULES_CRUD_TOKEN } from './rules.crud-token';
import {
  FREQUENCIES,
  lawCodesForGroups,
  type ComplianceFrequency,
} from '@domains/compliance-contract';
import { complianceRules } from './rules.schema';
import { complianceLaws } from '../laws/laws.schema';
import { complianceLawHandlers } from '../law-handlers/law-handlers.schema';
import { complianceFilings } from '../compliance-filings/compliance-filings.schema';
import { complianceClientRegistrations } from '../client-registrations/client-registrations.schema';
import { LawHandlersService } from '../law-handlers';
import { ComplianceFilingsCancellationService } from '../compliance-filings';
import { RULES_WORKFLOW } from './rules.workflow';
import type {
  CreateComplianceRuleDto,
  RulesListQuery,
  UpdateComplianceRuleDto,
} from './rules.dto';

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
 * I14: raised when the caller tries to change a rule-identity field
 * (`code`, `frequency`, `lawId`) on a rule that has already materialised at
 * least one filing. The UI uses `fields` to mark the offending inputs;
 * message is the human-readable one-liner.
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

function isUniqueViolation(error: unknown): boolean {
  // Drizzle wraps the underlying pg-driver error in a generic `Error` whose
  // `cause` is the actual `DatabaseError` carrying `code: '23505'`.
  const hasCode = (e: unknown): boolean =>
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === '23505';
  if (hasCode(error)) return true;
  if (typeof error === 'object' && error !== null && 'cause' in error) {
    return hasCode((error as { cause?: unknown }).cause);
  }
  return false;
}

export type ComplianceRuleStatus = 'draft' | 'active' | 'deprecated';

export interface RulesSummary {
  total: number;
  byStatus: { active: number; draft: number; deprecated: number };
}

const SORTABLE_RULE_COLUMNS: Record<string, ReturnType<typeof sql>> = {
  code: sql`r.code`,
  name: sql`r.name`,
  status: sql`r.status`,
  frequency: sql`r.frequency`,
  updatedAt: sql`r.updated_at`,
  createdAt: sql`r.created_at`,
  lawName: sql`l.name`,
  lawCode: sql`l.code`,
};

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
  status: 'deprecated';
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
 * I21: raised when deleting a `law_handlers` row would leave at least one
 * active `client_registration` for that law without a resolvable assignee.
 * The simulation walks the resolver with the row excluded and counts the
 * registrations whose resolution would break — `affectedRegistrationCount`
 * goes back to the UI so the admin can decide whether to reassign.
 */
export class LawHandlerRequiredError extends BadRequestException {
  constructor(handlerId: string, affectedRegistrationCount: number) {
    super({
      code: 'LAW_HANDLER_REQUIRED',
      message:
        `Cannot delete this handler: ${affectedRegistrationCount} active ` +
        `client registration(s) would be left without a resolvable assignee. ` +
        `Configure another handler for the law before removing this one.`,
      handlerId,
      affectedRegistrationCount,
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

/**
 * Merged service: CRUD delegates for the entity engine + the programmatic
 * domain helpers (expandRule, resolveAssignee, deprecate, I14/I15 edit
 * guards) used by automations, seeds, and the custom controller.
 *
 * Create/update route through the engine (events + audit fire), gated by
 * domain pre-checks: `create` verifies a default law handler exists, and
 * `update` runs the I14 identity-field immutability guard once filings have
 * been generated.
 */
@Injectable()
export class ComplianceRulesService {
  private readonly logger: ContextLogger;

  constructor(
    @Inject(RULES_CRUD_TOKEN) private readonly crud: BaseCrudService<typeof complianceRules>,
    private readonly database: DatabaseService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
    private readonly events: DomainEventEmitter,
    @Inject(forwardRef(() => LawHandlersService))
    private readonly lawHandlers: LawHandlersService,
    private readonly filingsCancellation: ComplianceFilingsCancellationService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ComplianceRulesService.name);
  }

  // ---- CRUD delegates (vendors template) -----------------------------------

  /**
   * List compliance rules with embedded law display fields (`lawCode`,
   * `lawName`, `lawJurisdiction`) per row + status / frequency / lawGroup /
   * jurisdiction / search / sort / pagination filters. Custom Drizzle path
   * with a single LEFT JOIN to `compliance_laws` so the row-shape ships in
   * one round-trip and the frontend doesn't have to fetch the laws lookup
   * separately. Replaces the entity-engine list path so we can express the
   * lawGroup / jurisdiction filters that traverse the laws table.
   *
   * RBAC scope is unused here (rules don't declare data-access scopes), so
   * we lose nothing by dropping the engine path. Soft-delete + tenant
   * scoping flow through `withScope`, no-ops when `compliance_rules`
   * carries neither column.
   */
  async list(
    params: RulesListQuery,
    accessCtx?: DataAccessContext,
  ): Promise<{
    data: Record<string, unknown>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const filterConditions = this.buildRulesFilters(params);
    const where = withScope(complianceRules, ...filterConditions);
    const whereSql = where ? sql`AND ${where}` : sql``;

    // Scope predicate (if any) is applied at CTE level — it references the
    // `compliance_rules` table directly, so we pre-filter there before
    // aliasing as `r` for the outer JOIN/filters.
    // Rules has no `dataAccess` config — actor scope is a no-op for this
    // entity. The `accessCtx` parameter is preserved on the public API for
    // controller-level consistency but does not gate any rows.
    const scopePredicate = undefined;
    const cteScope = withScope(complianceRules, scopePredicate);
    const cteWhere = cteScope ? sql`WHERE ${cteScope}` : sql``;
    const scopedRules = sql`(SELECT * FROM ${complianceRules} ${cteWhere})`;

    const sortKey = params.sort && SORTABLE_RULE_COLUMNS[params.sort] ? params.sort : 'name';
    const sortExpr = SORTABLE_RULE_COLUMNS[sortKey];
    const direction = params.order === 'desc' ? sql`DESC` : sql`ASC`;
    const offset = (params.page - 1) * params.limit;

    const totalRows = await this.database.db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM ${scopedRules} r
      LEFT JOIN ${complianceLaws} l ON l.id = r.law_id
      WHERE TRUE ${whereSql}
    `);
    const total = Number((totalRows.rows[0] as { total: number }).total);

    const dataRows = await this.database.db.execute(sql`
      SELECT
        r.id, r.code, r.name, r.law_id, r.frequency, r.status,
        r.due_day_of_month, r.due_month_offset, r.grace_period_days,
        r.description, r.created_at, r.updated_at,
        l.code AS law_code, l.name AS law_name, l.jurisdiction AS law_jurisdiction
      FROM ${scopedRules} r
      LEFT JOIN ${complianceLaws} l ON l.id = r.law_id
      WHERE TRUE ${whereSql}
      ORDER BY ${sortExpr} ${direction} NULLS LAST, r.id ASC
      LIMIT ${params.limit} OFFSET ${offset}
    `);

    const data = dataRows.rows.map((row) => this.toRuleListRow(row as Record<string, unknown>));

    return {
      data,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: params.limit > 0 ? Math.ceil(total / params.limit) : 0,
      },
    };
  }

  /**
   * Status-bucket counts for the rules list page header. Single round-trip;
   * each bucket is a FILTER (WHERE …) over the same scan.
   */
  async getSummary(accessCtx?: DataAccessContext): Promise<RulesSummary> {
    // Rules has no `dataAccess` config — actor scope is a no-op for this
    // entity. The `accessCtx` parameter is preserved on the public API for
    // controller-level consistency but does not gate any rows.
    const scopePredicate = undefined;
    const where = withScope(complianceRules, scopePredicate);
    const whereSql = where ? sql`WHERE ${where}` : sql``;

    const result = await this.database.db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
        COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_count,
        COUNT(*) FILTER (WHERE status = 'deprecated')::int AS deprecated_count
      FROM ${complianceRules}
      ${whereSql}
    `);

    const row = result.rows[0] as Record<string, number | string>;
    return {
      total: Number(row.total ?? 0),
      byStatus: {
        active: Number(row.active_count ?? 0),
        draft: Number(row.draft_count ?? 0),
        deprecated: Number(row.deprecated_count ?? 0),
      },
    };
  }

  private buildRulesFilters(params: RulesListQuery) {
    const conds = [];
    if (params.status) conds.push(sql`r.status = ${params.status}`);
    if (params.frequencies && params.frequencies.length > 0) {
      conds.push(sql`r.frequency = ANY(${params.frequencies}::text[])`);
    }
    if (params.jurisdictions && params.jurisdictions.length > 0) {
      conds.push(sql`l.jurisdiction = ANY(${params.jurisdictions}::text[])`);
    }
    if (params.lawIds && params.lawIds.length > 0) {
      conds.push(sql`r.law_id = ANY(${params.lawIds}::text[])`);
    }
    if (params.lawGroups && params.lawGroups.length > 0) {
      const codes = lawCodesForGroups(params.lawGroups);
      if (codes.length > 0) {
        conds.push(sql`UPPER(l.code) = ANY(${codes}::text[])`);
      } else {
        // The selected groups have no mapped law codes — match nothing rather
        // than every row.
        conds.push(sql`FALSE`);
      }
    }
    if (params.q) {
      const term = `%${params.q}%`;
      conds.push(sql`(r.code ILIKE ${term} OR r.name ILIKE ${term} OR l.name ILIKE ${term})`);
    }
    return conds;
  }

  private toRuleListRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      lawId: row.law_id,
      frequency: row.frequency,
      status: row.status,
      dueDayOfMonth: row.due_day_of_month,
      dueMonthOffset: row.due_month_offset,
      gracePeriodDays: row.grace_period_days,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lawCode: row.law_code ?? null,
      lawName: row.law_name ?? null,
      lawJurisdiction: row.law_jurisdiction ?? null,
    };
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.crud.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateComplianceRuleDto, actorId: string) {
    if (input.frequency !== undefined) {
      assertFrequency(input.frequency as string);
    }
    const hasHandler = await this.lawHandlers.hasDefaultHandler(input.lawId as string);
    if (!hasHandler) {
      throw new NoDefaultHandlerError(input.lawId as string);
    }
    // Workflow state is system-managed: pre-fill `status` with the workflow's
    // initialState. The DTO drops any caller-supplied value.
    try {
      return await this.crud.create(
        { ...input, status: RULES_WORKFLOW.initialState } as never,
        actorId,
      );
    } catch (error) {
      // The `compliance_rules_code_key` unique index enforces unique `code`
      // at the DB level. Translate the Postgres 23505 violation to a 409
      // Conflict so callers see a domain-meaningful error instead of a 500.
      if (isUniqueViolation(error)) {
        throw new ConflictException(`A rule with code "${(input as { code?: string }).code}" already exists`);
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateComplianceRuleDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    if (input.frequency !== undefined) {
      assertFrequency(input.frequency as string);
    }
    await this.assertUpdateAllowed(id, input as Record<string, unknown>);
    return this.crud.update(id, input as never, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.softDelete(id, actorId, accessCtx);
  }

  /**
   * Generic workflow transition. Loads the entity, validates the move
   * against the workflow def via `WorkflowEngineService.validateAndThrow`
   * (permissions, conditions, reason/comment requirements), then writes
   * the column update + workflow_transition_history row in a single tx
   * and emits `compliance-rules.<Field>Changed` after commit.
   *
   * Domain-specific cascades (e.g. rule deprecation cancelling in-flight
   * filings) stay on dedicated endpoints (`deprecate`); this one drives
   * plain status moves like draft → active.
   */
  async transition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const entity = await this.crud.findOneOrFail(id, accessCtx) as Record<string, unknown>;
    const fromState = entity[fieldKey] as string | null;
    if (!fromState) {
      throw new BadRequestException(`Entity has no current state for field '${fieldKey}'`);
    }

    const workflow = this.workflowRegistry.getByEntityField('compliance-rules', fieldKey);
    if (!workflow) {
      throw new BadRequestException(
        `No workflow registered for compliance-rules field '${fieldKey}'`,
      );
    }

    const validated = await this.workflowEngine.validateAndThrow({
      workflowSlug: workflow.slug,
      entityType: 'compliance-rules',
      entityId: id,
      fromState,
      toState,
      actorId,
      reason: options?.reason,
      comment: options?.comment,
      entityData: entity,
    });

    await this.database.db.transaction(async (tx) => {
      await tx
        .update(complianceRules)
        .set({ [fieldKey]: toState })
        .where(withScope(complianceRules, eq(complianceRules.id, id)));

      await this.workflowEngine.recordHistory(
        {
          workflowDefinitionId: validated.workflowDefinitionId,
          entityType: 'compliance-rules',
          entityId: id,
          fieldName: validated.fieldName,
          fromState,
          toState,
          transitionId: validated.transitionId,
          actorId,
          reason: options?.reason,
          comment: options?.comment,
        },
        tx,
      );
    });

    this.emitTransitionEvent({
      fieldKey,
      entityId: id,
      fromState,
      toState,
      transitionId: validated.transitionId,
      transitionName: validated.transitionName,
      actorId,
      reason: options?.reason,
      comment: options?.comment,
    });

    return this.crud.findOneOrFail(id);
  }

  /**
   * Emit `compliance-rules.<Field>Changed` after a workflow transition
   * commits. Shared between `transition()` and `deprecate()` so both
   * paths produce identical event payloads.
   */
  private emitTransitionEvent(params: {
    fieldKey: string;
    entityId: string;
    fromState: string;
    toState: string;
    transitionId: string;
    transitionName: string;
    actorId: string | null;
    reason?: string;
    comment?: string;
  }): void {
    const pascalField = params.fieldKey.charAt(0).toUpperCase() + params.fieldKey.slice(1);
    this.events.emitDynamic(`compliance-rules.${pascalField}Changed`, {
      entityType: 'compliance-rules',
      entityId: params.entityId,
      actorId: params.actorId,
      payload: {
        fieldKey: params.fieldKey,
        fromState: params.fromState,
        toState: params.toState,
        transitionId: params.transitionId,
        transitionName: params.transitionName,
        reason: params.reason,
        comment: params.comment,
      },
    });
  }

  // ---- Domain queries & lifecycle ------------------------------------------

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
      .where(withScope(complianceFilings, eq(complianceFilings.ruleId, ruleId)))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * I13 + I15: what the edit form needs to know before rendering.
   * `hasGeneratedFilings` drives the identity-field disable state; the count
   * is displayed in the forward-only save dialog ("N filings already
   * generated will keep their current due dates").
   */
  async getEditConstraints(
    ruleId: string,
    accessCtx?: DataAccessContext,
  ): Promise<{
    ruleId: string;
    hasGeneratedFilings: boolean;
    generatedFilingCount: number;
  }> {
    // Existence + scope check via the engine. If the actor can't read the
    // rule, surfaces NotFoundException (404) — same shape as a missing row,
    // which is the correct behaviour: the actor must not be able to detect
    // existence outside their scope.
    await this.crud.findOneOrFail(ruleId, accessCtx);
    const [row] = await this.database.db
      .select({ count: count() })
      .from(complianceFilings)
      .where(withScope(complianceFilings, eq(complianceFilings.ruleId, ruleId)));
    const generatedFilingCount = Number(row?.count ?? 0);
    return {
      ruleId,
      hasGeneratedFilings: generatedFilingCount > 0,
      generatedFilingCount,
    };
  }

  /**
   * I14 identity-field guard. When the payload touches an identity field
   * (`code`, `frequency`, `lawId`) AND the rule already has filings AND the
   * new value is actually different from the current value, throw
   * ImmutableRuleFieldError. Same-value writes pass through so idempotent
   * PATCHes don't 400 spuriously.
   *
   * Forward-only fields (`dueDayOfMonth`, `dueMonthOffset`, `gracePeriodDays`)
   * are explicitly allowed — Q9 keeps them editable and relies on the
   * generator being a pure no-op on conflict (I16) to hold the forward-only
   * invariant without needing a server-side shift.
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
  async previewDeprecation(
    ruleId: string,
    accessCtx?: DataAccessContext,
  ): Promise<DeprecationPreview> {
    // Existence + actor-scope check; same rationale as getEditConstraints.
    await this.crud.findOneOrFail(ruleId, accessCtx);
    const [row] = await this.database.db
      .select({ count: count() })
      .from(complianceFilings)
      .where(withScope(
        complianceFilings,
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
   *   - Flips `compliance_rules.status` to 'deprecated' through the workflow
   *     engine, which writes the rule's `workflow_transition_history` row
   *     (captures actor, reason, comment) and enforces the
   *     `compliance-rules.deprecate` permission declared on the transition.
   *     Generator (I9) short-circuits on `status === 'deprecated'`, so no
   *     new filings will be produced.
   *   - Existing non-terminal filings are preserved by default. If the admin
   *     opts in via `alsoCancelInFlight`, every non-terminal filing for this
   *     rule is cancelled inside the same tx as the rule transition, each
   *     with its own workflow_transition_history row (reason: "Rule
   *     deprecated").
   *   - No domain-specific event emitted — the rule's own transition row
   *     plus the per-filing cancellation rows are the authoritative audit.
   *
   * Composition mirrors `ClientsService.transition`: the engine's split
   * primitives (`validateTransition` → `applyTransition` → `emitTransitionEvent`)
   * let this service own the tx so the rule status flip and every filing
   * cancellation commit together. Idempotent on already-deprecated rules
   * (no-ops and returns an empty list).
   */
  async deprecate(
    ruleId: string,
    params: {
      alsoCancelInFlight?: boolean;
      // Was `string | null` before the engine reroute; the engine's
      // permission resolver requires a real user id, so this is now a
      // hard requirement. Only call site (the controller) always passes
      // `user.userId` from the auth-decoded JWT, so no caller is broken.
      actorId: string;
      comment?: string;
    },
    accessCtx?: DataAccessContext,
  ): Promise<DeprecationResult> {
    // Existence + actor-scope check via the engine. Throws NotFoundException
    // when the rule is invisible to the actor — keeps the destructive cascade
    // gated by the same scope as the read view.
    const rule = (await this.crud.findOneOrFail(ruleId, accessCtx)) as unknown as ComplianceRule;
    if (rule.status === 'deprecated') {
      return { ruleId, status: 'deprecated', cancelledFilingIds: [] };
    }

    // Validate via the workflow engine — enforces `requiredPermissions:
    // ['compliance-rules.deprecate']` declared on the active → deprecated
    // (or draft → deprecated) transition, plus the reasonRequired +
    // commentRequired gating that lives on those transition definitions.
    const workflow = this.workflowRegistry.getByEntityField('compliance-rules', 'status');
    if (!workflow) {
      throw new BadRequestException(`No workflow registered for compliance-rules.status`);
    }
    const fromState = rule.status;
    const validated = await this.workflowEngine.validateAndThrow({
      workflowSlug: workflow.slug,
      entityType: 'compliance-rules',
      entityId: ruleId,
      fromState,
      toState: 'deprecated',
      actorId: params.actorId,
      reason: REASON_RULE_DEPRECATED,
      comment: params.comment,
      entityData: rule as unknown as Record<string, unknown>,
    });

    const alsoCancelInFlight = params.alsoCancelInFlight ?? false;

    const cancelledIds = await this.database.db.transaction(async (tx) => {
      // Phase 2: write the column update + workflow_transition_history row
      // on the same tx as the cascade so a failure rolls back atomically.
      await tx
        .update(complianceRules)
        .set({ status: 'deprecated' })
        .where(withScope(complianceRules, eq(complianceRules.id, ruleId)));

      await this.workflowEngine.recordHistory(
        {
          workflowDefinitionId: validated.workflowDefinitionId,
          entityType: 'compliance-rules',
          entityId: ruleId,
          fieldName: validated.fieldName,
          fromState,
          toState: 'deprecated',
          transitionId: validated.transitionId,
          actorId: params.actorId,
          reason: REASON_RULE_DEPRECATED,
          comment: params.comment,
        },
        tx,
      );

      if (!alsoCancelInFlight) return [];

      const inFlight = await tx
        .select({ id: complianceFilings.id, status: complianceFilings.status })
        .from(complianceFilings)
        .where(withScope(
          complianceFilings,
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

    this.emitTransitionEvent({
      fieldKey: 'status',
      entityId: ruleId,
      fromState,
      toState: 'deprecated',
      transitionId: validated.transitionId,
      transitionName: validated.transitionName,
      actorId: params.actorId,
      reason: REASON_RULE_DEPRECATED,
      comment: params.comment,
    });

    this.logger.log('Rule deprecated', {
      ruleId,
      ruleCode: rule.code,
      cancelledCount: cancelledIds.length,
      alsoCancelInFlight,
    });

    return { ruleId, status: 'deprecated', cancelledFilingIds: cancelledIds };
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
    const result = await this.findResolvedHandler(lawId, clientId);
    if (result.kind === 'resolved') return result.orgEntityId;
    if (result.kind === 'ambiguous') {
      throw new AmbiguousHandlerError(lawId, clientId, result.tier);
    }
    throw new NoDefaultHandlerError(lawId);
  }

  /**
   * I19: boolean predicate twin of `resolveAssignee`. Returns true iff the
   * 4-tier walk would yield exactly one handler — i.e., `resolveAssignee`
   * would return a value rather than throw.
   *
   * Ambiguous tiers count as NOT resolvable: a registration whose generation
   * would later throw on ambiguity is just as broken as one with no handler
   * at all, so the precondition guard rejects both. The remediation differs
   * (admin disambiguates vs admin configures), but the user-facing UX —
   * "fix the law's handler config before registering" — is the same.
   *
   * `clientId` optional: when provided, walks all 4 tiers (client-specific
   * rows take precedence over globals, matching `resolveAssignee`). When
   * omitted, only checks global handlers (tier 3/4) — useful for "does this
   * law have a default handler at all?" checks at registration-create time
   * before a specific client is bound.
   *
   * `excludeHandlerId` simulates removing a row before resolving — used by
   * the I21 delete guard to ask "if I delete this handler, will the
   * remaining set still resolve cleanly for each affected registration?".
   */
  async canResolveAssignee(
    lawId: string,
    clientId?: string,
    excludeHandlerId?: string,
  ): Promise<boolean> {
    const result = await this.findResolvedHandler(lawId, clientId, excludeHandlerId);
    return result.kind === 'resolved';
  }

  /**
   * I21: simulate deleting a handler and check whether every active
   * registration for that law would still resolve to an assignee. Throws
   * `LawHandlerRequiredError` with the affected count if any registration
   * would break.
   *
   * Reads `complianceClientRegistrations` directly because asking
   * `ClientRegistrationsService` would create a circular module dependency
   * (it already injects `ComplianceRulesService` for the I20 guard). Direct
   * schema access stays inside the compliance domain — same pattern this
   * service already uses for `complianceFilings`.
   *
   * The simulation runs `canResolveAssignee` per registration with the
   * handler excluded; ambiguous-after-removal also counts as "broken"
   * (matches the precondition semantics in I19/I20).
   */
  async assertHandlerCanBeDeleted(handlerId: string): Promise<void> {
    const [handler] = await this.database.db
      .select()
      .from(complianceLawHandlers)
      .where(eq(complianceLawHandlers.id, handlerId))
      .limit(1);
    if (!handler) {
      throw new NotFoundException(`Law handler ${handlerId} not found`);
    }

    const activeRegistrations = await this.database.db
      .select({
        clientId: complianceClientRegistrations.clientId,
        lawId: complianceClientRegistrations.lawId,
      })
      .from(complianceClientRegistrations)
      .where(
        and(
          eq(complianceClientRegistrations.lawId, handler.lawId),
          isNull(complianceClientRegistrations.deactivatedAt),
        ),
      );

    if (activeRegistrations.length === 0) return;

    // Hoist the handler fetch out of the loop: every registration we're
    // checking has the same lawId (= handler.lawId), so the underlying
    // `findResolvedHandler` would re-SELECT the same handler set on every
    // iteration. Load once, then resolve from memory per registration.
    const handlersForLaw = await this.database.db
      .select()
      .from(complianceLawHandlers)
      .where(eq(complianceLawHandlers.lawId, handler.lawId));
    const remainingHandlers = handlersForLaw.filter((h) => h.id !== handlerId);

    let brokenCount = 0;
    for (const reg of activeRegistrations) {
      const result = this.resolveFromHandlerList(remainingHandlers, reg.clientId);
      if (result.kind !== 'resolved') brokenCount += 1;
    }

    if (brokenCount > 0) {
      throw new LawHandlerRequiredError(handlerId, brokenCount);
    }
  }

  private async findResolvedHandler(
    lawId: string,
    clientId?: string,
    excludeHandlerId?: string,
  ): Promise<
    | { kind: 'resolved'; orgEntityId: string }
    | { kind: 'ambiguous'; tier: string }
    | { kind: 'none' }
  > {
    const allRows = await this.database.db
      .select()
      .from(complianceLawHandlers)
      .where(eq(complianceLawHandlers.lawId, lawId));
    const rows = excludeHandlerId
      ? allRows.filter((r) => r.id !== excludeHandlerId)
      : allRows;
    return this.resolveFromHandlerList(rows, clientId);
  }

  /**
   * Pure four-tier resolution over a preloaded handler set. Extracted from
   * `findResolvedHandler` so callers that already have the handler list in
   * memory (e.g. `assertHandlerCanBeDeleted`'s per-registration loop) don't
   * re-SELECT for every check.
   */
  private resolveFromHandlerList(
    rows: typeof complianceLawHandlers.$inferSelect[],
    clientId?: string,
  ):
    | { kind: 'resolved'; orgEntityId: string }
    | { kind: 'ambiguous'; tier: string }
    | { kind: 'none' } {
    if (clientId !== undefined) {
      const clientRows = rows.filter((r) => r.clientId === clientId);
      const clientPrimary = clientRows.filter((r) => r.isPrimary);
      if (clientPrimary.length === 1) return { kind: 'resolved', orgEntityId: clientPrimary[0]!.orgEntityId };
      if (clientPrimary.length > 1) return { kind: 'ambiguous', tier: 'client-primary' };
      if (clientRows.length === 1) return { kind: 'resolved', orgEntityId: clientRows[0]!.orgEntityId };
      if (clientRows.length > 1) return { kind: 'ambiguous', tier: 'client-any' };
    }

    const globalRows = rows.filter((r) => r.clientId === null);
    const globalPrimary = globalRows.filter((r) => r.isPrimary);
    if (globalPrimary.length === 1) return { kind: 'resolved', orgEntityId: globalPrimary[0]!.orgEntityId };
    if (globalPrimary.length > 1) return { kind: 'ambiguous', tier: 'global-primary' };
    if (globalRows.length === 1) return { kind: 'resolved', orgEntityId: globalRows[0]!.orgEntityId };
    if (globalRows.length > 1) return { kind: 'ambiguous', tier: 'global-any' };

    return { kind: 'none' };
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
