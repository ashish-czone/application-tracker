import { Injectable } from '@nestjs/common';
import { asc, eq, gte, lte, isNotNull, inArray, ilike, sql, count, notInArray } from 'drizzle-orm';
import { DatabaseService, users, withScope } from '@packages/database';
import { clients } from '@packages/directory';
import { orgUnits } from '@packages/org-units';
import { type DataAccessContext, DataAccessScopeService } from '@packages/rbac';
import { complianceLaws } from '../laws/laws.schema';
import { complianceFilings } from './compliance-filings.schema';
import { buildFilingsScopePredicate } from './compliance-filings.scope';

const NOT_COMPLETED_STATES = ['pending', 'in_progress', 'review', 'rejected'];

export interface TrendBucket {
  /** YYYY-MM */
  month: string;
  onTime: number;
  late: number;
  overdue: number;
}

export interface ClientBreakdownRow {
  clientId: string;
  clientName: string;
  totalFilings: number;
  onTime: number;
  late: number;
  overdue: number;
  onTimeRate: number;
}

export interface AgingBucket {
  range: '1-7' | '8-15' | '16-30' | '30+';
  count: number;
}

export interface SeverityBreakdownRow {
  priority: string;
  count: number;
}

/**
 * Per-team filing counts for the date range — IDs and counts only,
 * no display fields. Consumed by the app-level OrgUnitsReportsService
 * that joins team names from `OrgUnitService.findAll()`.
 */
export interface TeamFilingCounts {
  assigneeTeamId: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  onTime: number;
  late: number;
}

export interface ReportRange {
  from: string;
  to: string;
}

/**
 * One row of the unbounded overdue filings export. Display fields
 * (clientName, lawCode, assigneeTeamName, assignee names) are joined
 * server-side via the same shared-identity / intra-domain pattern the
 * list endpoint uses, so the CSV contains user-readable labels without
 * a client-side join.
 */
export interface OverdueFilingExportRow {
  id: string;
  title: string;
  externalKey: string | null;
  clientId: string;
  clientName: string;
  lawId: string;
  lawCode: string | null;
  status: string;
  priority: string;
  dueDate: string;
  daysOverdue: number;
  assigneeTeamId: string | null;
  assigneeTeamName: string | null;
  assigneeId: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

/**
 * Reports service for compliance-filings — single-domain aggregations
 * over the `compliance_filings` table. Sibling to ComplianceFilingsService
 * (CRUD), Lookup, Cancellation, and AssigneeCleanup; separated because
 * reports are a distinct concern with its own surface (4 read endpoints
 * under /compliance-filings/reports/* + 1 cross-domain primitive).
 *
 * Cross-domain reports (e.g. "team workload" — joining filings counts
 * with team names from org-units) live at the app composition layer
 * (apps/compliance/src/modules/org-units/org-units.reports.service.ts)
 * and consume the `getCountsByTeam` primitive from this service.
 */
@Injectable()
export class ComplianceFilingsReportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly dataAccessScope: DataAccessScopeService,
  ) {}

  /**
   * Filing-outcome trend by month over a date range. The bucket is determined
   * by the filing's `dueDate` (calendar month). "On time" = completed AND
   * completedAt <= dueDate; "late" = completed AND completedAt > dueDate;
   * "overdue" = not yet completed/cancelled AND dueDate < today. One SQL
   * GROUP BY — no row-by-row JS aggregation, no client-side fetching.
   */
  async getTrend(
    range: ReportRange,
    today: string,
    accessCtx?: DataAccessContext,
  ): Promise<TrendBucket[]> {
    const scopePredicate = await buildFilingsScopePredicate(this.dataAccessScope, accessCtx);
    const rows = await this.database.db
      .select({
        month: sql<string>`to_char(${complianceFilings.dueDate}::date, 'YYYY-MM')`,
        onTime: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date <= ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        late: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date > ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        overdue: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = ANY(ARRAY['pending','in_progress','review','rejected']) AND ${complianceFilings.dueDate}::date < ${today}::date THEN 1 ELSE 0 END)::int`,
      })
      .from(complianceFilings)
      .where(withScope(
        complianceFilings,
        scopePredicate,
        gte(complianceFilings.dueDate, range.from),
        lte(complianceFilings.dueDate, range.to),
      ))
      .groupBy(sql`to_char(${complianceFilings.dueDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${complianceFilings.dueDate}::date, 'YYYY-MM')`);

    return rows.map((r) => ({
      month: r.month,
      onTime: Number(r.onTime),
      late: Number(r.late),
      overdue: Number(r.overdue),
    }));
  }

  /**
   * Per-client breakdown over a date range. Each row counts the filings whose
   * dueDate falls within the range, broken down by outcome. The on-time rate
   * is `onTime / (onTime + late + overdue)` rounded to integer percent.
   *
   * Optional `q` filters by client name (ILIKE %q%) — same field the frontend
   * shows. Done server-side via the existing JOIN to `clients` so we don't
   * fetch the full set and `.filter()` it in JS.
   */
  async getByClient(
    range: ReportRange,
    today: string,
    options?: { q?: string },
    accessCtx?: DataAccessContext,
  ): Promise<ClientBreakdownRow[]> {
    // Joining the shared identity `clients` table is allowed per
    // module-boundaries.md → "Shared Identity Tables". Embeds the client
    // name on each row so the frontend doesn't need a side fetch.
    const scopePredicate = await buildFilingsScopePredicate(this.dataAccessScope, accessCtx);
    const baseConditions = [
      scopePredicate,
      gte(complianceFilings.dueDate, range.from),
      lte(complianceFilings.dueDate, range.to),
      // Joined soft-delete + tenanted table: the outer withScope only
      // filters the driver (complianceFilings); clients needs its own
      // scope predicate.
      withScope(clients),
    ];
    if (options?.q && options.q.trim().length > 0) {
      baseConditions.push(ilike(clients.name, `%${options.q.trim()}%`));
    }

    const rows = await this.database.db
      .select({
        clientId: complianceFilings.clientId,
        clientName: clients.name,
        totalFilings: count().mapWith(Number),
        onTime: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date <= ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        late: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date > ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        overdue: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = ANY(ARRAY['pending','in_progress','review','rejected']) AND ${complianceFilings.dueDate}::date < ${today}::date THEN 1 ELSE 0 END)::int`,
      })
      .from(complianceFilings)
      .leftJoin(clients, eq(clients.id, complianceFilings.clientId))
      .where(withScope(complianceFilings, ...baseConditions))
      .groupBy(complianceFilings.clientId, clients.name)
      .orderBy(sql`COUNT(*) DESC`);

    return rows.map((r) => {
      const onTime = Number(r.onTime);
      const late = Number(r.late);
      const overdue = Number(r.overdue);
      const sum = onTime + late + overdue;
      return {
        clientId: r.clientId,
        clientName: r.clientName ?? '',
        totalFilings: Number(r.totalFilings),
        onTime,
        late,
        overdue,
        onTimeRate: sum > 0 ? Math.round((onTime / sum) * 100) : 0,
      };
    });
  }

  /**
   * Aging buckets for currently-overdue filings (not completed, not
   * cancelled, dueDate < today). Single GROUP BY with CASE WHEN bands.
   */
  async getOverdueAging(today: string, accessCtx?: DataAccessContext): Promise<AgingBucket[]> {
    const scopePredicate = await buildFilingsScopePredicate(this.dataAccessScope, accessCtx);
    const rows = await this.database.db
      .select({
        range: sql<string>`CASE
          WHEN (${today}::date - ${complianceFilings.dueDate}::date) <= 7 THEN '1-7'
          WHEN (${today}::date - ${complianceFilings.dueDate}::date) <= 15 THEN '8-15'
          WHEN (${today}::date - ${complianceFilings.dueDate}::date) <= 30 THEN '16-30'
          ELSE '30+'
        END`,
        count: count().mapWith(Number),
      })
      .from(complianceFilings)
      .where(withScope(
        complianceFilings,
        scopePredicate,
        inArray(complianceFilings.status, NOT_COMPLETED_STATES),
        isNotNull(complianceFilings.dueDate),
        sql`${complianceFilings.dueDate}::date < ${today}::date`,
      ))
      .groupBy(sql`CASE
        WHEN (${today}::date - ${complianceFilings.dueDate}::date) <= 7 THEN '1-7'
        WHEN (${today}::date - ${complianceFilings.dueDate}::date) <= 15 THEN '8-15'
        WHEN (${today}::date - ${complianceFilings.dueDate}::date) <= 30 THEN '16-30'
        ELSE '30+'
      END`);

    const order: AgingBucket['range'][] = ['1-7', '8-15', '16-30', '30+'];
    const map = new Map(rows.map((r) => [r.range as AgingBucket['range'], Number(r.count)]));
    return order.map((range) => ({ range, count: map.get(range) ?? 0 }));
  }

  /**
   * Severity breakdown of currently-overdue filings, grouped by priority.
   */
  async getOverdueSeverity(today: string, accessCtx?: DataAccessContext): Promise<SeverityBreakdownRow[]> {
    const scopePredicate = await buildFilingsScopePredicate(this.dataAccessScope, accessCtx);
    const rows = await this.database.db
      .select({
        priority: complianceFilings.priority,
        count: count().mapWith(Number),
      })
      .from(complianceFilings)
      .where(withScope(
        complianceFilings,
        scopePredicate,
        inArray(complianceFilings.status, NOT_COMPLETED_STATES),
        isNotNull(complianceFilings.dueDate),
        sql`${complianceFilings.dueDate}::date < ${today}::date`,
      ))
      .groupBy(complianceFilings.priority);

    return rows.map((r) => ({
      priority: r.priority,
      count: Number(r.count),
    }));
  }

  /**
   * Per-team filing counts for the date range — IDs and counts only.
   * Cross-domain primitive: callers (e.g. the app's OrgUnitsReportsService)
   * resolve team names from OrgUnitService and compose the user-facing
   * `TeamWorkloadRow` shape there. Keeping this method free of any
   * org-units dependency is what lets compliance-filings stay free of
   * cross-module DI.
   */
  async getCountsByTeam(
    range: ReportRange,
    today: string,
    accessCtx?: DataAccessContext,
  ): Promise<TeamFilingCounts[]> {
    const scopePredicate = await buildFilingsScopePredicate(this.dataAccessScope, accessCtx);
    const rows = await this.database.db
      .select({
        assigneeTeamId: complianceFilings.assigneeTeamId,
        totalAssigned: count().mapWith(Number),
        completed: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' THEN 1 ELSE 0 END)::int`,
        inProgress: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = ANY(ARRAY['pending','in_progress','review','rejected']) AND (${complianceFilings.dueDate}::date >= ${today}::date OR ${complianceFilings.dueDate} IS NULL) THEN 1 ELSE 0 END)::int`,
        overdue: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = ANY(ARRAY['pending','in_progress','review','rejected']) AND ${complianceFilings.dueDate}::date < ${today}::date THEN 1 ELSE 0 END)::int`,
        onTime: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date <= ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        late: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date > ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
      })
      .from(complianceFilings)
      .where(withScope(
        complianceFilings,
        scopePredicate,
        notInArray(complianceFilings.status, ['cancelled']),
        gte(complianceFilings.dueDate, range.from),
        lte(complianceFilings.dueDate, range.to),
      ))
      .groupBy(complianceFilings.assigneeTeamId)
      .orderBy(sql`COUNT(*) DESC`);

    return rows.map((r) => ({
      assigneeTeamId: r.assigneeTeamId,
      totalAssigned: Number(r.totalAssigned),
      completed: Number(r.completed),
      inProgress: Number(r.inProgress),
      overdue: Number(r.overdue),
      onTime: Number(r.onTime),
      late: Number(r.late),
    }));
  }

  /**
   * Unbounded list of currently-overdue filings (status not completed/cancelled,
   * dueDate < today). Sibling to the paginated `ComplianceFilingsService.list`
   * with `bucket=overdue`, but explicitly without LIMIT — the "is currently
   * overdue" predicate is the bound, not a row count. Used by the CSV export
   * endpoint so the operator gets the full set, not "the first 50 of N".
   *
   * Embeds `clientName` (shared-identity join), `lawCode` (intra-domain
   * sibling join allowed by module-boundaries.md), and assignee labels
   * (`assigneeTeamName`, `assigneeFirstName`, `assigneeLastName`) so the
   * CSV does not need a client-side join.
   *
   * Driver actor-scope is applied via `buildFilingsScopePredicate` and
   * ANDed into the WHERE — joined tables get only the structural soft-
   * delete + tenant predicates from `withScope` on each LEFT JOIN ON
   * clause. See `data-access-scope.md` § "Joined tables: the driver is
   * the authorization root".
   */
  async listOverdueForExport(
    today: string,
    accessCtx?: DataAccessContext,
  ): Promise<OverdueFilingExportRow[]> {
    const scopePredicate = await buildFilingsScopePredicate(this.dataAccessScope, accessCtx);

    const rows = await this.database.db
      .select({
        id: complianceFilings.id,
        title: complianceFilings.title,
        externalKey: complianceFilings.externalKey,
        clientId: complianceFilings.clientId,
        clientName: clients.name,
        lawId: complianceFilings.lawId,
        lawCode: complianceLaws.code,
        status: complianceFilings.status,
        priority: complianceFilings.priority,
        dueDate: complianceFilings.dueDate,
        assigneeTeamId: complianceFilings.assigneeTeamId,
        assigneeTeamName: orgUnits.name,
        assigneeId: complianceFilings.assigneeId,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
        periodStart: complianceFilings.periodStart,
        periodEnd: complianceFilings.periodEnd,
      })
      .from(complianceFilings)
      .leftJoin(clients,        withScope(clients,        eq(complianceFilings.clientId,        clients.id)))
      .leftJoin(complianceLaws, withScope(complianceLaws, eq(complianceFilings.lawId,           complianceLaws.id)))
      .leftJoin(orgUnits,       withScope(orgUnits,       eq(complianceFilings.assigneeTeamId, orgUnits.id)))
      .leftJoin(users,          withScope(users,          eq(complianceFilings.assigneeId,      users.id)))
      .where(withScope(
        complianceFilings,
        scopePredicate,
        inArray(complianceFilings.status, NOT_COMPLETED_STATES),
        isNotNull(complianceFilings.dueDate),
        sql`${complianceFilings.dueDate}::date < ${today}::date`,
      ))
      .orderBy(asc(complianceFilings.dueDate));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      externalKey: r.externalKey ?? null,
      clientId: r.clientId,
      clientName: r.clientName ?? '',
      lawId: r.lawId,
      lawCode: r.lawCode ?? null,
      status: r.status,
      priority: r.priority,
      dueDate: r.dueDate ?? '',
      daysOverdue: r.dueDate ? daysBetween(r.dueDate, today) : 0,
      assigneeTeamId: r.assigneeTeamId ?? null,
      assigneeTeamName: r.assigneeTeamName ?? null,
      assigneeId: r.assigneeId ?? null,
      assigneeFirstName: r.assigneeFirstName ?? null,
      assigneeLastName: r.assigneeLastName ?? null,
      periodStart: r.periodStart ?? null,
      periodEnd: r.periodEnd ?? null,
    }));
  }
}

/**
 * Calendar-day distance from `from` (earlier) to `to` (later). Both inputs
 * are `YYYY-MM-DD` strings interpreted in UTC — the underlying column is a
 * `DATE` (no timezone), so UTC arithmetic gives the right calendar-day
 * count regardless of the server's timezone.
 */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}
