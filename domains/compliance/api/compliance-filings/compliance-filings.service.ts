import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService, eq, inArray, sql, withScope } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { complianceFilings } from './compliance-filings.schema';
import { LawsService } from '../laws';
import { buildFilingExternalKey } from './compliance-filings.config';
import { COMPLIANCE_FILINGS_WORKFLOW } from './compliance-filings.workflow';
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

@Injectable()
export class ComplianceFilingsService {
  constructor(
    @Inject('ENTITY_SERVICE_compliance-filings') private readonly entityService: EntityService,
    private readonly lawsService: LawsService,
    private readonly database: DatabaseService,
  ) {}

  /**
   * List filings with embedded law display fields (`lawCode`, `lawName`,
   * `lawJurisdiction`) per row. The entity engine already injects `__label`
   * fields for lookup columns (clientId, lawId, ruleId, assigneeTeamId,
   * assigneeId), but lookup labels are single-valued; the dashboard widgets
   * and list page need the law's code AND jurisdiction together. We resolve
   * those via a single batched call to LawsService — service composition
   * across modules, never a JOIN.
   */
  async list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    const result = await this.entityService.list(query, accessCtx);
    const lawIds = collectLawIds(result.data);
    if (lawIds.size === 0) return result;

    const laws = await this.lawsService.findDisplayByIds([...lawIds]);
    const byId = new Map(laws.map((l) => [l.id, l]));

    return {
      ...result,
      data: result.data.map((row) => {
        const lawId = typeof row.lawId === 'string' ? row.lawId : null;
        const law = lawId ? byId.get(lawId) : undefined;
        if (!law) return row;
        return {
          ...row,
          lawCode: law.code,
          lawName: law.name,
          lawJurisdiction: law.jurisdiction,
        };
      }),
    };
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
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
    return this.entityService.create(finalPayload, actorId);
  }

  update(id: string, input: UpdateComplianceFilingDto, actorId: string, accessCtx?: DataAccessContext) {
    const finalPayload = applyCompletedAt(input as Record<string, unknown>);
    return this.entityService.update(id, finalPayload, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  /**
   * Generic workflow transition. The filing workflow has many transitions
   * (pending → in_progress, in_progress → review, review → completed/rejected,
   * etc.); the engine carries permission checks and history rows so this
   * service stays a thin pass-through.
   */
  transition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ) {
    return this.entityService.transition(id, fieldKey, toState, actorId, options, accessCtx);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }

  /**
   * Aggregated KPI counts for the filings list page header. Single wire call,
   * fans out internally to 7 parallel `entityService.list({limit: 1})` queries
   * — each computes COUNT under the same RBAC + tenant + soft-delete scope as
   * the list endpoint, so users only see counts for filings they can read.
   * `today` is a calendar date string in app-tz; caller (controller) resolves
   * it from APP_TIMEZONE.
   */
  async getSummary(
    today: string,
    options?: { clientId?: string },
    accessCtx?: DataAccessContext,
  ): Promise<FilingsSummary> {
    const inSevenDays = addDays(today, 7);
    const notCompletedStates = ['pending', 'in_progress', 'review', 'rejected'];
    const scopeFilter: Array<{ field: string; operator: string; value: unknown }> = options?.clientId
      ? [{ field: 'clientId', operator: 'eq', value: options.clientId }]
      : [];

    const buildQuery = (extra: Array<{ field: string; operator: string; value: unknown }>): BaseListQuery => ({
      page: 1,
      limit: 1,
      filters: JSON.stringify([...scopeFilter, ...extra]),
    });

    const [
      total,
      overdue,
      dueToday,
      dueThisWeek,
      upcoming,
      completed,
      cancelled,
      overdueClientCount,
    ] = await Promise.all([
      this.entityService.list(buildQuery([]), accessCtx),
      this.entityService.list(
        buildQuery([
          { field: 'status', operator: 'in', value: notCompletedStates },
          { field: 'dueDate', operator: 'lt', value: today },
        ]),
        accessCtx,
      ),
      this.entityService.list(
        buildQuery([
          { field: 'status', operator: 'in', value: notCompletedStates },
          { field: 'dueDate', operator: 'eq', value: today },
        ]),
        accessCtx,
      ),
      this.entityService.list(
        buildQuery([
          { field: 'status', operator: 'in', value: notCompletedStates },
          { field: 'dueDate', operator: 'gt', value: today },
          { field: 'dueDate', operator: 'lte', value: inSevenDays },
        ]),
        accessCtx,
      ),
      this.entityService.list(
        buildQuery([
          { field: 'status', operator: 'in', value: notCompletedStates },
          { field: 'dueDate', operator: 'gt', value: inSevenDays },
        ]),
        accessCtx,
      ),
      this.entityService.list(
        buildQuery([{ field: 'status', operator: 'eq', value: 'completed' }]),
        accessCtx,
      ),
      this.entityService.list(
        buildQuery([{ field: 'status', operator: 'eq', value: 'cancelled' }]),
        accessCtx,
      ),
      this.countOverdueDistinctClients(today, options?.clientId, accessCtx),
    ]);

    return {
      total: total.meta.total,
      overdue: overdue.meta.total,
      dueToday: dueToday.meta.total,
      dueThisWeek: dueThisWeek.meta.total,
      upcoming: upcoming.meta.total,
      completed: completed.meta.total,
      cancelled: cancelled.meta.total,
      overdueClientCount,
    };
  }

  /**
   * COUNT(DISTINCT client_id) for non-terminal filings whose due date has
   * passed. Lives outside the entity-engine's `list` path because it asks a
   * shape `entityService.list({limit:1}).meta.total` cannot answer.
   *
   * Scope: tenant + soft-delete via `withScope`, plus the actor's row-level
   * RBAC predicate from `entityService.getScopePredicate(ctx)` interpolated
   * into the WHERE — same scope `entityService.list({…}, accessCtx)` would
   * apply if the engine could express DISTINCT count. The clientId option
   * is the existing per-client scope filter from the summary endpoint.
   */
  private async countOverdueDistinctClients(
    today: string,
    clientId: string | undefined,
    accessCtx?: DataAccessContext,
  ): Promise<number> {
    const scopePredicate = accessCtx ? await this.entityService.getScopePredicate(accessCtx) : undefined;
    const where = withScope(
      complianceFilings,
      scopePredicate,
      inArray(complianceFilings.status, ['pending', 'in_progress', 'review', 'rejected']),
      sql`${complianceFilings.dueDate}::date < ${today}::date`,
      ...(clientId ? [eq(complianceFilings.clientId, clientId)] : []),
    );
    const whereSql = where ? sql`WHERE ${where}` : sql``;
    const result = await this.database.db.execute(sql`
      SELECT COUNT(DISTINCT client_id)::int AS count
      FROM ${complianceFilings}
      ${whereSql}
    `);
    const row = result.rows[0] as { count: number | string } | undefined;
    return Number(row?.count ?? 0);
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
