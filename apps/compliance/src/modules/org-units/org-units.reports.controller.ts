import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { todayInTimezone } from '@packages/common';
import { AccessContext, RequirePermission, type DataAccessContext } from '@packages/rbac';
import {
  csvDisposition,
  toCsv,
} from '@domains/compliance-api/compliance-filings';
import { OrgUnitsReportsService } from './org-units.reports.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveCalendarDate(input: string | undefined, fallback: string): string {
  return input && DATE_RE.test(input) ? input : fallback;
}

function resolveToday(): string {
  return todayInTimezone(process.env.APP_TIMEZONE ?? 'UTC');
}

function defaultRange(today: string): { from: string; to: string } {
  // Last 6 months ending today.
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() - 5);
  dt.setUTCDate(1);
  const from = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return { from, to: today };
}

@Controller('org-units/reports')
export class OrgUnitsReportsController {
  constructor(private readonly reports: OrgUnitsReportsService) {}

  @Get('team-workload')
  @RequirePermission('reports.read')
  getTeamWorkload(
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);
    return this.reports.getTeamWorkload({ from, to }, today, { q }, accessCtx);
  }

  /**
   * CSV export of the per-team workload — same composition as `/team-workload`,
   * no LIMIT (the date range is the bound). Lives at the app composition
   * layer because workload composes filings counts (compliance) with team
   * names (org-units), and apps own cross-domain composition.
   */
  @Get('team-workload.csv')
  @RequirePermission('reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getTeamWorkloadCsv(
    @Res() res: Response,
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ): Promise<void> {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);

    const rows = await this.reports.getTeamWorkload({ from, to }, today, { q }, accessCtx);

    const csv = toCsv(
      [
        'Team ID',
        'Team',
        'Total Assigned',
        'Completed',
        'In Progress',
        'Overdue',
        'On-Time Rate (%)',
      ],
      rows.map((r) => [
        r.assigneeTeamId,
        r.assigneeTeamName,
        r.totalAssigned,
        r.completed,
        r.inProgress,
        r.overdue,
        r.onTimeRate,
      ]),
    );

    res.setHeader('Content-Disposition', csvDisposition('workload', today));
    res.send(csv);
  }
}
