import { Injectable } from '@nestjs/common';
import { DatabaseService, users, asc, desc, eq, sql, type SQL } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { todayInTimezone } from '@packages/common';
import { clients } from './clients-ref';

export type ClientRiskLevel = 'healthy' | 'at-risk' | 'critical';
export type ClientStatusKey = 'active' | 'onboarding' | 'dormant';

export interface ClientsListParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: ClientStatusKey;
  handlerIds?: string[];
  risks?: ClientRiskLevel[];
  q?: string;
}

export interface ClientRollupRow extends Record<string, unknown> {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  industry: string | null;
  complianceStatus: string | null;
  complianceAccountManagerId: string | null;
  complianceAccountManagerId__label: string | null;
  complianceOnboardedAt: Date | null;
  registeredLaws: number;
  openFilings: number;
  overdueFilings: number;
  dueThisWeek: number;
  completedFilings: number;
  onTimeFilings: number;
  onTimePct: number;
  lastFilingDate: string | null;
  risk: ClientRiskLevel;
}

export interface ClientsSummary {
  total: number;
  byStatus: { active: number; onboarding: number; dormant: number };
  byRisk: { healthy: number; 'at-risk': number; critical: number };
  totalOverdue: number;
  clientsWithOverdue: number;
  totalRegistrations: number;
  avgOnTimePct: number;
}

export interface HandlerOption {
  id: string;
  name: string;
}

const NOT_COMPLETED_STATES = ['pending', 'in_progress', 'review', 'rejected'] as const;
const SORTABLE_COLUMNS: Record<string, SQL> = {
  name: sql`c.name`,
  legalName: sql`c.legal_name`,
  complianceStatus: sql`c.compliance_status`,
  complianceOnboardedAt: sql`c.compliance_onboarded_at`,
  registeredLaws: sql`registered_laws`,
  openFilings: sql`open_filings`,
  overdueFilings: sql`overdue_filings`,
  onTimePct: sql`on_time_pct`,
  lastFilingDate: sql`last_filing_date`,
};

/**
 * Server-side rollup queries that power the compliance clients list view +
 * KPI summary. The list endpoint joins per-client aggregates (registered laws,
 * open / overdue / due-this-week filings, on-time %, last filing date,
 * derived risk band) so the frontend doesn't have to fetch full filing /
 * registration tables and join in JavaScript.
 *
 * Risk is derived inline by SQL CASE — `critical` if overdueFilings > 0,
 * `at-risk` if any non-completed filing is due in the next 7 days, otherwise
 * `healthy`. Filtering by risk uses the same expression as a HAVING-style
 * predicate in the outer WHERE.
 *
 * RBAC scope: compliance clients have no `dataAccess.scopes` declared, so
 * the engine's scope filter is a no-op for this entity. Tenant scoping is
 * applied via `withTenant(clients, …)` and is itself a no-op when the
 * `clients` table has no tenantId column.
 */
@Injectable()
export class ClientsRollupService {
  private readonly appTimezone: string;

  constructor(private readonly database: DatabaseService) {
    this.appTimezone = process.env.APP_TIMEZONE ?? 'UTC';
  }

  /**
   * List compliance clients with embedded rollup metrics + handler display
   * name. Custom Drizzle path because the rollups require GROUP BY +
   * conditional aggregates which the entity engine's list pipeline doesn't
   * express.
   */
  async list(params: ClientsListParams): Promise<{
    data: ClientRollupRow[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const today = todayInTimezone(this.appTimezone);
    const sevenDays = addDays(today, 7);

    const filterConditions = this.buildFilterConditions(params, today, sevenDays);
    const where = withTenant(clients, ...filterConditions);
    const whereSql = where ? sql`AND ${where}` : sql``;

    const sortKey = params.sort && SORTABLE_COLUMNS[params.sort] ? params.sort : 'name';
    const sortExpr = SORTABLE_COLUMNS[sortKey];
    const direction = params.order === 'desc' ? sql`DESC` : sql`ASC`;
    const offset = (params.page - 1) * params.limit;

    const totalRows = await this.database.db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM (${this.buildBaseQuery(today, sevenDays)}) c
      WHERE TRUE ${whereSql}
    `);
    const total = Number((totalRows.rows[0] as { total: number }).total);

    const dataRows = await this.database.db.execute(sql`
      SELECT * FROM (${this.buildBaseQuery(today, sevenDays)}) c
      WHERE TRUE ${whereSql}
      ORDER BY ${sortExpr} ${direction} NULLS LAST, c.id ASC
      LIMIT ${params.limit} OFFSET ${offset}
    `);

    const data = dataRows.rows.map((row) => this.toRollupRow(row as Record<string, unknown>));

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
   * Page-level KPI summary. One query joins the same rollup CTE against the
   * compliance-client filter, then aggregates byStatus + byRisk counts in a
   * single round-trip.
   */
  async getSummary(): Promise<ClientsSummary> {
    const today = todayInTimezone(this.appTimezone);
    const sevenDays = addDays(today, 7);

    const where = withTenant(clients);
    const whereSql = where ? sql`AND ${where}` : sql``;

    const result = await this.database.db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE compliance_status = 'active')::int AS active_count,
        COUNT(*) FILTER (WHERE compliance_status = 'onboarding')::int AS onboarding_count,
        COUNT(*) FILTER (WHERE compliance_status = 'dormant')::int AS dormant_count,
        COUNT(*) FILTER (WHERE risk = 'critical')::int AS critical_count,
        COUNT(*) FILTER (WHERE risk = 'at-risk')::int AS at_risk_count,
        COUNT(*) FILTER (WHERE risk = 'healthy')::int AS healthy_count,
        COALESCE(SUM(overdue_filings)::int, 0) AS total_overdue,
        COUNT(*) FILTER (WHERE overdue_filings > 0)::int AS clients_with_overdue,
        COALESCE(SUM(registered_laws)::int, 0) AS total_registrations,
        COALESCE(ROUND(AVG(on_time_pct) FILTER (WHERE completed_filings > 0))::int, 0) AS avg_on_time_pct
      FROM (${this.buildBaseQuery(today, sevenDays)}) c
      WHERE TRUE ${whereSql}
    `);

    const row = result.rows[0] as Record<string, number | string>;
    return {
      total: Number(row.total ?? 0),
      byStatus: {
        active: Number(row.active_count ?? 0),
        onboarding: Number(row.onboarding_count ?? 0),
        dormant: Number(row.dormant_count ?? 0),
      },
      byRisk: {
        healthy: Number(row.healthy_count ?? 0),
        'at-risk': Number(row.at_risk_count ?? 0),
        critical: Number(row.critical_count ?? 0),
      },
      totalOverdue: Number(row.total_overdue ?? 0),
      clientsWithOverdue: Number(row.clients_with_overdue ?? 0),
      totalRegistrations: Number(row.total_registrations ?? 0),
      avgOnTimePct: Number(row.avg_on_time_pct ?? 0),
    };
  }

  /**
   * Distinct handler (account manager) options for the filter dropdown.
   * Returns one entry per user currently assigned as an account manager on
   * at least one compliance client. Display name = "firstName lastName" or
   * email fallback.
   */
  async getHandlerOptions(): Promise<HandlerOption[]> {
    const tenantWhere = withTenant(clients);

    const distinctIds = await this.database.db
      .selectDistinct({ id: clients.complianceAccountManagerId })
      .from(clients)
      .where(
        tenantWhere
          ? sql`${tenantWhere} AND ${clients.complianceBecameClientAt} IS NOT NULL AND ${clients.deletedAt} IS NULL AND ${clients.complianceAccountManagerId} IS NOT NULL`
          : sql`${clients.complianceBecameClientAt} IS NOT NULL AND ${clients.deletedAt} IS NULL AND ${clients.complianceAccountManagerId} IS NOT NULL`,
      );

    const ids = distinctIds
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (ids.length === 0) return [];

    const userRows = await this.database.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(sql`${users.id} = ANY(${ids}::text[])`);

    const options = userRows.map((u) => ({
      id: u.id,
      name: formatUserDisplay(u.firstName, u.lastName, u.email),
    }));
    options.sort((a, b) => a.name.localeCompare(b.name));
    return options;
  }

  /**
   * Build the inner SELECT that produces one row per compliance client with
   * the rollup columns. Used as a subquery by both list() and getSummary()
   * so the risk computation stays in one place.
   */
  private buildBaseQuery(today: string, sevenDays: string) {
    const notCompleted = sql.raw(
      NOT_COMPLETED_STATES.map((s) => `'${s}'`).join(', '),
    );
    return sql`
      SELECT
        c.id,
        c.name,
        c.legal_name,
        c.email,
        c.phone,
        c.tax_id,
        c.industry,
        c.compliance_status,
        c.compliance_account_manager_id,
        c.compliance_onboarded_at,
        u.first_name AS handler_first_name,
        u.last_name AS handler_last_name,
        u.email AS handler_email,
        COALESCE(reg.registered_laws, 0) AS registered_laws,
        COALESCE(f.open_filings, 0) AS open_filings,
        COALESCE(f.overdue_filings, 0) AS overdue_filings,
        COALESCE(f.due_this_week, 0) AS due_this_week,
        COALESCE(f.completed_filings, 0) AS completed_filings,
        COALESCE(f.on_time_filings, 0) AS on_time_filings,
        CASE
          WHEN COALESCE(f.completed_filings, 0) > 0
            THEN ROUND((f.on_time_filings::numeric / f.completed_filings) * 100)::int
          ELSE 0
        END AS on_time_pct,
        f.last_filing_date,
        CASE
          WHEN COALESCE(f.overdue_filings, 0) > 0 THEN 'critical'
          WHEN COALESCE(f.due_this_week, 0) > 0 THEN 'at-risk'
          ELSE 'healthy'
        END AS risk
      FROM clients c
      LEFT JOIN users u ON u.id = c.compliance_account_manager_id
      LEFT JOIN (
        SELECT client_id,
          COUNT(DISTINCT law_id) FILTER (WHERE deactivated_at IS NULL)::int AS registered_laws
        FROM compliance_client_registrations
        GROUP BY client_id
      ) reg ON reg.client_id = c.id
      LEFT JOIN (
        SELECT client_id,
          COUNT(*) FILTER (WHERE status IN (${notCompleted}) AND deleted_at IS NULL)::int AS open_filings,
          COUNT(*) FILTER (WHERE status IN (${notCompleted}) AND due_date < ${today} AND deleted_at IS NULL)::int AS overdue_filings,
          COUNT(*) FILTER (WHERE status IN (${notCompleted}) AND due_date >= ${today} AND due_date <= ${sevenDays} AND deleted_at IS NULL)::int AS due_this_week,
          COUNT(*) FILTER (WHERE status = 'completed' AND deleted_at IS NULL)::int AS completed_filings,
          COUNT(*) FILTER (WHERE status = 'completed' AND DATE(completed_at AT TIME ZONE ${this.appTimezone}) <= due_date AND deleted_at IS NULL)::int AS on_time_filings,
          TO_CHAR(MAX(completed_at) FILTER (WHERE status = 'completed' AND deleted_at IS NULL) AT TIME ZONE ${this.appTimezone}, 'YYYY-MM-DD') AS last_filing_date
        FROM compliance_filings
        GROUP BY client_id
      ) f ON f.client_id = c.id
      WHERE c.compliance_became_client_at IS NOT NULL AND c.deleted_at IS NULL
    `;
  }

  private buildFilterConditions(
    params: ClientsListParams,
    _today: string,
    _sevenDays: string,
  ): SQL[] {
    const conds: SQL[] = [];
    if (params.status) conds.push(sql`c.compliance_status = ${params.status}`);
    if (params.handlerIds && params.handlerIds.length > 0) {
      conds.push(sql`c.compliance_account_manager_id = ANY(${params.handlerIds}::text[])`);
    }
    if (params.risks && params.risks.length > 0) {
      conds.push(sql`c.risk = ANY(${params.risks}::text[])`);
    }
    if (params.q) {
      const term = `%${params.q}%`;
      conds.push(
        sql`(c.name ILIKE ${term} OR c.legal_name ILIKE ${term} OR c.tax_id ILIKE ${term})`,
      );
    }
    return conds;
  }

  private toRollupRow(row: Record<string, unknown>): ClientRollupRow {
    const handlerId = row.compliance_account_manager_id as string | null;
    const handlerName = handlerId
      ? formatUserDisplay(
          row.handler_first_name as string | null,
          row.handler_last_name as string | null,
          row.handler_email as string | null,
        )
      : null;
    return {
      id: row.id as string,
      name: row.name as string,
      legalName: (row.legal_name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      taxId: (row.tax_id as string | null) ?? null,
      industry: (row.industry as string | null) ?? null,
      complianceStatus: (row.compliance_status as string | null) ?? null,
      complianceAccountManagerId: handlerId,
      complianceAccountManagerId__label: handlerName,
      complianceOnboardedAt: (row.compliance_onboarded_at as Date | null) ?? null,
      registeredLaws: Number(row.registered_laws ?? 0),
      openFilings: Number(row.open_filings ?? 0),
      overdueFilings: Number(row.overdue_filings ?? 0),
      dueThisWeek: Number(row.due_this_week ?? 0),
      completedFilings: Number(row.completed_filings ?? 0),
      onTimeFilings: Number(row.on_time_filings ?? 0),
      onTimePct: Number(row.on_time_pct ?? 0),
      lastFilingDate: (row.last_filing_date as string | null) ?? null,
      risk: (row.risk as ClientRiskLevel) ?? 'healthy',
    };
  }
}

function formatUserDisplay(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string {
  const parts = [firstName, lastName].filter((s): s is string => !!s && s.length > 0);
  if (parts.length > 0) return parts.join(' ');
  return email ?? '—';
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
