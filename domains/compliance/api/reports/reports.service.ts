import { Injectable } from '@nestjs/common';
import { and, eq, gte, lte, isNull, isNotNull, inArray, sql, count, notInArray } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { complianceFilings } from '../schema/compliance-filings';

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

export interface TeamWorkloadRow {
  assigneeTeamId: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  onTimeRate: number;
}

export interface ReportRange {
  from: string;
  to: string;
}

@Injectable()
export class ComplianceReportsService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Filing-outcome trend by month over a date range. The bucket is determined
   * by the filing's `dueDate` (calendar month). "On time" = completed AND
   * completedAt <= dueDate; "late" = completed AND completedAt > dueDate;
   * "overdue" = not yet completed/cancelled AND dueDate < today. One SQL
   * GROUP BY — no row-by-row JS aggregation, no client-side fetching.
   */
  async getTrend(range: ReportRange, today: string): Promise<TrendBucket[]> {
    const rows = await this.database.db
      .select({
        month: sql<string>`to_char(${complianceFilings.dueDate}::date, 'YYYY-MM')`,
        onTime: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date <= ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        late: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date > ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        overdue: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = ANY(ARRAY['pending','in_progress','review','rejected']) AND ${complianceFilings.dueDate}::date < ${today}::date THEN 1 ELSE 0 END)::int`,
      })
      .from(complianceFilings)
      .where(
        withTenant(
          complianceFilings,
          and(
            isNull(complianceFilings.deletedAt),
            gte(complianceFilings.dueDate, range.from),
            lte(complianceFilings.dueDate, range.to),
          ),
        ),
      )
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
   */
  async getByClient(range: ReportRange, today: string): Promise<ClientBreakdownRow[]> {
    const rows = await this.database.db
      .select({
        clientId: complianceFilings.clientId,
        totalFilings: count().mapWith(Number),
        onTime: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date <= ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        late: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = 'completed' AND ${complianceFilings.completedAt}::date > ${complianceFilings.dueDate}::date THEN 1 ELSE 0 END)::int`,
        overdue: sql<number>`SUM(CASE WHEN ${complianceFilings.status} = ANY(ARRAY['pending','in_progress','review','rejected']) AND ${complianceFilings.dueDate}::date < ${today}::date THEN 1 ELSE 0 END)::int`,
      })
      .from(complianceFilings)
      .where(
        withTenant(
          complianceFilings,
          and(
            isNull(complianceFilings.deletedAt),
            gte(complianceFilings.dueDate, range.from),
            lte(complianceFilings.dueDate, range.to),
          ),
        ),
      )
      .groupBy(complianceFilings.clientId)
      .orderBy(sql`COUNT(*) DESC`);

    return rows.map((r) => {
      const onTime = Number(r.onTime);
      const late = Number(r.late);
      const overdue = Number(r.overdue);
      const sum = onTime + late + overdue;
      return {
        clientId: r.clientId,
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
  async getOverdueAging(today: string): Promise<AgingBucket[]> {
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
      .where(
        withTenant(
          complianceFilings,
          and(
            isNull(complianceFilings.deletedAt),
            inArray(complianceFilings.status, NOT_COMPLETED_STATES),
            isNotNull(complianceFilings.dueDate),
            sql`${complianceFilings.dueDate}::date < ${today}::date`,
          ),
        ),
      )
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
  async getOverdueSeverity(today: string): Promise<SeverityBreakdownRow[]> {
    const rows = await this.database.db
      .select({
        priority: complianceFilings.priority,
        count: count().mapWith(Number),
      })
      .from(complianceFilings)
      .where(
        withTenant(
          complianceFilings,
          and(
            isNull(complianceFilings.deletedAt),
            inArray(complianceFilings.status, NOT_COMPLETED_STATES),
            isNotNull(complianceFilings.dueDate),
            sql`${complianceFilings.dueDate}::date < ${today}::date`,
          ),
        ),
      )
      .groupBy(complianceFilings.priority);

    return rows.map((r) => ({
      priority: r.priority,
      count: Number(r.count),
    }));
  }

  /**
   * Per-team workload over a date range. Counts filings assigned to each
   * team and breaks down by completed/in-progress/overdue. On-time rate is
   * `completed / (completed + late)` — treats "in progress" as still
   * earnable.
   */
  async getTeamWorkload(range: ReportRange, today: string): Promise<TeamWorkloadRow[]> {
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
      .where(
        withTenant(
          complianceFilings,
          and(
            isNull(complianceFilings.deletedAt),
            notInArray(complianceFilings.status, ['cancelled']),
            gte(complianceFilings.dueDate, range.from),
            lte(complianceFilings.dueDate, range.to),
          ),
        ),
      )
      .groupBy(complianceFilings.assigneeTeamId)
      .orderBy(sql`COUNT(*) DESC`);

    return rows.map((r) => {
      const onTime = Number(r.onTime);
      const late = Number(r.late);
      const sum = onTime + late;
      return {
        assigneeTeamId: r.assigneeTeamId,
        totalAssigned: Number(r.totalAssigned),
        completed: Number(r.completed),
        inProgress: Number(r.inProgress),
        overdue: Number(r.overdue),
        onTimeRate: sum > 0 ? Math.round((onTime / sum) * 100) : 0,
      };
    });
  }
}
