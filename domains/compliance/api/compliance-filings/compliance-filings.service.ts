import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  count,
  DatabaseService,
  eq,
  sql,
  users,
  withScope,
} from '@packages/database';
import { BaseCrudService } from '@packages/crud-base';
// `BaseListQuery` from entity-engine has the wide `[key: string]: unknown`
// passthrough that the controller's `buildBaseListQuery(...)` output relies on
// (filters/sort/search/order plus bare clientId/lawId/etc.). The crud-base
// version is `{page?, limit?}` only — too narrow for the custom list path
// here. The two type names match by design; the engine's is the consumer-
// facing shape.
import type { BaseListQuery } from '@packages/entity-engine';
import { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import { DomainEventEmitter } from '@packages/events';
import { orgUnits } from '@packages/org-units';
import { buildListQuery } from '@packages/query-builder';
import { type DataAccessContext, DataAccessScopeService } from '@packages/rbac';
import { complianceFilings } from './compliance-filings.schema';
import { clients } from '../clients/clients.schema';
import { LawsService } from '../laws';
import { buildFilingExternalKey } from './compliance-filings.external-key';
import { COMPLIANCE_FILINGS_WORKFLOW } from './compliance-filings.workflow';
import { COMPLIANCE_FILINGS_CRUD_TOKEN } from './compliance-filings.crud-token';
import { buildFilingsScopePredicate } from './compliance-filings.scope';
import type { CreateComplianceFilingDto, UpdateComplianceFilingDto } from './compliance-filings.dto';

/**
 * Stamps / clears `completedAt` based on the `status` field in the payload:
 * moving TO `completed` stamps now(), moving AWAY clears it. Payloads that
 * don't touch status are returned unchanged. Moved out of the
 * `beforeCreate` / `beforeUpdate` config hooks so the logic lives next to
 * the other create/update behaviour.
 */
function applyCompletedAt(payload: Record<string, unknown>): Record<string, unknown> {
  if (!('status' in payload)) return payload;
  return {
    ...payload,
    completedAt: payload.status === 'completed' ? new Date() : null,
  };
}

function collectLawIds(rows: ReadonlyArray<Record<string, unknown>>): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = row.lawId;
    if (typeof id === 'string' && id.length > 0) ids.add(id);
  }
  return ids;
}

export interface FilingsSummary {
  total: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  /** Distinct clients with at least one overdue filing — feeds the FilingsPage banner. */
  overdueClientCount: number;
}

function addDays(calendarDate: string, days: number): string {
  const [y, m, d] = calendarDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Whitelisted filterable columns on `compliance_filings`. Maps the JSON
 * filter `field` name to a Drizzle column reference so a structured
 * predicate like `{field:'clientId', operator:'in', value:['c1','c2']}`
 * resolves to a real SQL condition. Unknown fields are ignored — frontend
 * cannot push arbitrary column predicates through.
 */
const FILTERABLE_FILING_COLUMNS = {
  id: complianceFilings.id,
  status: complianceFilings.status,
  priority: complianceFilings.priority,
  clientId: complianceFilings.clientId,
  lawId: complianceFilings.lawId,
  ruleId: complianceFilings.ruleId,
  assigneeId: complianceFilings.assigneeId,
  assigneeTeamId: complianceFilings.assigneeTeamId,
  dueDate: complianceFilings.dueDate,
  periodStart: complianceFilings.periodStart,
  periodEnd: complianceFilings.periodEnd,
  completedAt: complianceFilings.completedAt,
  externalKey: complianceFilings.externalKey,
  createdAt: complianceFilings.createdAt,
  updatedAt: complianceFilings.updatedAt,
  createdBy: complianceFilings.createdBy,
} as const;

/**
 * Whitelisted sort columns. Driver columns sort directly; joined display
 * columns (clientName / assigneeFirstName / assigneeLastName /
 * assigneeTeamName) sort via the JOIN-resolved column reference so the
 * primary sort happens server-side in the same round-trip — no
 * post-fetch reordering. Anything outside the whitelist falls back to
 * the default registered with `buildListQuery` (`dueDate ASC` + the
 * helper's `id ASC` tiebreaker).
 */
const SORTABLE_FILING_COLUMNS = {
  dueDate: complianceFilings.dueDate,
  periodStart: complianceFilings.periodStart,
  periodEnd: complianceFilings.periodEnd,
  completedAt: complianceFilings.completedAt,
  status: complianceFilings.status,
  priority: complianceFilings.priority,
  createdAt: complianceFilings.createdAt,
  updatedAt: complianceFilings.updatedAt,
  title: complianceFilings.title,
  clientName: clients.name,
  assigneeFirstName: users.firstName,
  assigneeLastName: users.lastName,
  assigneeTeamName: orgUnits.name,
} as const;

@Injectable()
export class ComplianceFilingsService {
  constructor(
    @Inject(COMPLIANCE_FILINGS_CRUD_TOKEN)
    private readonly crud: BaseCrudService<typeof complianceFilings>,
    private readonly lawsService: LawsService,
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
    private readonly dataAccessScope: DataAccessScopeService,
  ) {}

  /**
   * List filings with embedded display fields per row: `clientName`,
   * `assigneeFirstName`, `assigneeLastName`, `assigneeTeamName` (all four
   * via SQL LEFT JOIN), plus `lawCode` / `lawName` / `lawJurisdiction`
   * (still via service composition — laws is not a shared identity table,
   * so the cross-module-join allowance doesn't extend to it).
   *
   * The driver (`compliance_filings`) carries the actor-scope predicate;
   * joined tables (`clients`, `users`, `org_units`) get only structural
   * scope — soft-delete + tenant via `withScope(...)` on each LEFT JOIN
   * ON clause. Soft-delete predicates living in the JOIN ON (rather than
   * the WHERE) means a filing whose linked client / assignee is soft-
   * deleted still appears in the response with the joined column NULL,
   * instead of disappearing from the user's list. See `data-access-scope.md`
   * § "Joined tables: the driver is the authorization root".
   *
   * Bypasses `BaseCrudService.list` because the base only handles a
   * single-table SELECT — joins, projection, and total-count are
   * consumer responsibilities once the shape grows. Driver scope is
   * built explicitly via `buildFilingsScopePredicate(...)` (same helper
   * used by `getSummary` and the report endpoints) so the filings.read
   * scope shape stays in one place.
   *
   * Honors the full `BaseListQuery` shape supplied by the controller's
   * `buildBaseListQuery(...)` translator: structured `filters` JSON
   * (clientId / lawId / ruleId / status / dueDate / etc., already merged
   * with the bucket / dueBefore / dueAfter / notCompleted shorthand),
   * `sort` + `order` against a sortable-column whitelist, multi-column
   * `search`, plus belt-and-braces passthrough on `clientId` / `lawId` /
   * `ruleId` / `assigneeId` / `assigneeTeamId` if any consumer ever sends
   * those bare on the URL instead of via the filters JSON. COUNT applies
   * the same WHERE so `meta.total` matches the rendered page.
   */
  async list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    const scopePredicate = await buildFilingsScopePredicate(this.dataAccessScope, accessCtx);

    // The shared `buildListQuery` helper composes scope (tenant +
    // soft-delete + actor-scope), structured `filters` JSON, bare
    // passthrough id filters, search, and pagination into one WHERE +
    // ORDER BY pair that both the rows query and the COUNT query reuse.
    // The search column list crosses table boundaries (clients.name) —
    // the helper just builds an `OR(ilike(...), ...)` against whichever
    // columns it's given; the caller is responsible for adding the
    // matching JOIN to BOTH the rows AND the count queries so the WHERE
    // resolves against the same FROM shape.
    //
    // Per `.claude/rules/data-scoping.md`, `includeDeleted` flips the
    // soft-delete leg only (via `withScopeIncludingDeleted`); tenant +
    // actor-scope still apply unchanged.
    const built = buildListQuery(complianceFilings, query, {
      scopePredicate,
      filterableColumns: FILTERABLE_FILING_COLUMNS,
      sortableColumns: SORTABLE_FILING_COLUMNS,
      searchableColumns: [
        complianceFilings.title,
        complianceFilings.description,
        complianceFilings.externalKey,
        clients.name,
      ],
      defaultSort: { field: 'dueDate', order: 'asc' },
      includeDeleted: query.includeDeleted,
    });

    const rows = await this.database.db
      .select({
        filing: complianceFilings,
        clientName: clients.name,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
        assigneeTeamName: orgUnits.name,
      })
      .from(complianceFilings)
      .leftJoin(clients,  withScope(clients,  eq(complianceFilings.clientId,        clients.id)))
      .leftJoin(users,    withScope(users,    eq(complianceFilings.assigneeId,      users.id)))
      .leftJoin(orgUnits, withScope(orgUnits, eq(complianceFilings.assigneeTeamId, orgUnits.id)))
      .where(built.where)
      .orderBy(...built.orderBy)
      .limit(built.limit)
      .offset(built.offset);

    // The COUNT must JOIN `clients` because the WHERE may reference
    // `clients.name` via the search predicate. Without the JOIN, the
    // search arm would compile against a missing FROM table. The other
    // joined tables (users / orgUnits) aren't referenced by any filter
    // / search arm today, but joining them keeps the COUNT FROM shape
    // identical to the rows FROM shape and removes a foot-gun the next
    // time someone adds a filterable assignee predicate.
    const [totalRow] = await this.database.db
      .select({ total: count() })
      .from(complianceFilings)
      .leftJoin(clients,  withScope(clients,  eq(complianceFilings.clientId,        clients.id)))
      .leftJoin(users,    withScope(users,    eq(complianceFilings.assigneeId,      users.id)))
      .leftJoin(orgUnits, withScope(orgUnits, eq(complianceFilings.assigneeTeamId, orgUnits.id)))
      .where(built.where);

    const flat: Record<string, unknown>[] = rows.map((row) => ({
      ...(row.filing as Record<string, unknown>),
      clientName: row.clientName,
      assigneeFirstName: row.assigneeFirstName,
      assigneeLastName: row.assigneeLastName,
      assigneeTeamName: row.assigneeTeamName,
    }));

    const lawIds = collectLawIds(flat);
    if (lawIds.size > 0) {
      const laws = await this.lawsService.findDisplayByIds([...lawIds]);
      const byId = new Map(laws.map((l) => [l.id, l]));
      for (const row of flat) {
        const lawId = typeof row.lawId === 'string' ? row.lawId : null;
        const law = lawId ? byId.get(lawId) : undefined;
        if (law) {
          row.lawCode = law.code;
          row.lawName = law.name;
          row.lawJurisdiction = law.jurisdiction;
        }
      }
    }

    return {
      data: flat,
      meta: built.paginationMeta(Number(totalRow?.total ?? 0)),
    };
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.crud.findOneOrFail(id, accessCtx);
  }

  /**
   * Derive the externalKey idempotency column from (ruleId, clientId,
   * periodStart) when not explicitly provided, stamp `status` with the
   * workflow initialState (state is system-managed; the DTO drops any
   * caller-supplied value), and stamp `completedAt` based on the resulting
   * status. These used to live in the `beforeCreate` config hook; moving
   * here keeps all create-time logic in one place.
   */
  create(input: CreateComplianceFilingDto, actorId: string) {
    const withExternalKey = this.ensureExternalKey(input as Record<string, unknown>);
    const withInitialState = {
      ...withExternalKey,
      status: COMPLIANCE_FILINGS_WORKFLOW.initialState,
    };
    const finalPayload = applyCompletedAt(withInitialState);
    return this.crud.create(finalPayload as never, actorId);
  }

  update(id: string, input: UpdateComplianceFilingDto, actorId: string, accessCtx?: DataAccessContext) {
    const finalPayload = applyCompletedAt(input as Record<string, unknown>);
    return this.crud.update(id, finalPayload as never, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.softDelete(id, actorId, accessCtx);
  }

  /**
   * Generic workflow transition. The filing workflow has many transitions
   * (pending → in_progress, in_progress → review, review → completed/rejected,
   * etc.). Loads the entity, validates via `WorkflowEngineService.validateAndThrow`
   * (permissions + reason/comment + conditions), then writes the column
   * update + workflow_transition_history row in a single tx and emits
   * `compliance-filings.<Field>Changed` after commit.
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

    const workflow = this.workflowRegistry.getByEntityField('compliance-filings', fieldKey);
    if (!workflow) {
      throw new BadRequestException(
        `No workflow registered for compliance-filings field '${fieldKey}'`,
      );
    }

    const validated = await this.workflowEngine.validateAndThrow({
      workflowSlug: workflow.slug,
      entityType: 'compliance-filings',
      entityId: id,
      fromState,
      toState,
      actorId,
      reason: options?.reason,
      comment: options?.comment,
      entityData: entity,
    });

    // Stamp `completedAt` based on the destination state so the column
    // reflects when the filing reached its terminal state. Mirrors the
    // create/update path's `applyCompletedAt` shim.
    const setValues: Record<string, unknown> = { [fieldKey]: toState };
    if (fieldKey === 'status') {
      setValues.completedAt = toState === 'completed' ? new Date() : null;
    }

    await this.database.db.transaction(async (tx) => {
      await tx
        .update(complianceFilings)
        .set(setValues)
        .where(withScope(complianceFilings, eq(complianceFilings.id, id)));

      await this.workflowEngine.recordHistory(
        {
          workflowDefinitionId: validated.workflowDefinitionId,
          entityType: 'compliance-filings',
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
    this.events.emitDynamic(`compliance-filings.${pascalField}Changed`, {
      entityType: 'compliance-filings',
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

  /**
   * Aggregated KPI counts for the filings list page header.
   *
   * Pre-lift this fanned out to 7 parallel `entityService.list({limit:1})`
   * queries plus a separate DISTINCT-count query — 8 round-trips for what
   * is fundamentally a single aggregation. Post-lift the same shape is one
   * SQL with `COUNT(*) FILTER (WHERE …)` per bucket — same scope (tenant +
   * soft-delete via `withScope`, optional actor scope via
   * `DataAccessScopeService`, optional clientId pin), one round-trip,
   * one consistent snapshot.
   *
   * `today` is a calendar date string in app-tz; caller (controller)
   * resolves it from APP_TIMEZONE.
   */
  async getSummary(
    today: string,
    options?: { clientId?: string },
    accessCtx?: DataAccessContext,
  ): Promise<FilingsSummary> {
    const inSevenDays = addDays(today, 7);
    const notCompletedStates = ['pending', 'in_progress', 'review', 'rejected'];

    const scopePredicate = await buildFilingsScopePredicate(this.dataAccessScope, accessCtx);
    const where = withScope(
      complianceFilings,
      scopePredicate,
      ...(options?.clientId ? [eq(complianceFilings.clientId, options.clientId)] : []),
    );
    const whereSql = where ? sql`WHERE ${where}` : sql``;

    const result = await this.database.db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE ${complianceFilings.status} IN ${sql.raw(`(${notCompletedStates.map((s) => `'${s}'`).join(', ')})`)}
            AND ${complianceFilings.dueDate}::date < ${today}::date
        )::int AS overdue,
        COUNT(*) FILTER (
          WHERE ${complianceFilings.status} IN ${sql.raw(`(${notCompletedStates.map((s) => `'${s}'`).join(', ')})`)}
            AND ${complianceFilings.dueDate}::date = ${today}::date
        )::int AS due_today,
        COUNT(*) FILTER (
          WHERE ${complianceFilings.status} IN ${sql.raw(`(${notCompletedStates.map((s) => `'${s}'`).join(', ')})`)}
            AND ${complianceFilings.dueDate}::date > ${today}::date
            AND ${complianceFilings.dueDate}::date <= ${inSevenDays}::date
        )::int AS due_this_week,
        COUNT(*) FILTER (
          WHERE ${complianceFilings.status} IN ${sql.raw(`(${notCompletedStates.map((s) => `'${s}'`).join(', ')})`)}
            AND ${complianceFilings.dueDate}::date > ${inSevenDays}::date
        )::int AS upcoming,
        COUNT(*) FILTER (WHERE ${complianceFilings.status} = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE ${complianceFilings.status} = 'cancelled')::int AS cancelled,
        COUNT(DISTINCT ${complianceFilings.clientId}) FILTER (
          WHERE ${complianceFilings.status} IN ${sql.raw(`(${notCompletedStates.map((s) => `'${s}'`).join(', ')})`)}
            AND ${complianceFilings.dueDate}::date < ${today}::date
        )::int AS overdue_client_count
      FROM ${complianceFilings}
      ${whereSql}
    `);

    const row = (result.rows[0] ?? {}) as Record<string, number | string | null>;
    const num = (key: string): number => Number(row[key] ?? 0);

    return {
      total: num('total'),
      overdue: num('overdue'),
      dueToday: num('due_today'),
      dueThisWeek: num('due_this_week'),
      upcoming: num('upcoming'),
      completed: num('completed'),
      cancelled: num('cancelled'),
      overdueClientCount: num('overdue_client_count'),
    };
  }

  private ensureExternalKey(payload: Record<string, unknown>): Record<string, unknown> {
    const ruleId = payload.ruleId as string | undefined;
    const clientId = payload.clientId as string | undefined;
    const periodStart = payload.periodStart as string | undefined;
    if (!ruleId || !clientId || !periodStart || payload.externalKey != null) {
      return payload;
    }
    return {
      ...payload,
      externalKey: buildFilingExternalKey(ruleId, clientId, periodStart),
    };
  }
}
