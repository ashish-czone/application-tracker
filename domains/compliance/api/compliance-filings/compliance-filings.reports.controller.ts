import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { todayInTimezone } from '@packages/common';
import { AccessContext, RequirePermission, type DataAccessContext } from '@packages/rbac';
import { ComplianceFilingsReportsService } from './compliance-filings.reports.service';
import { csvDisposition, toCsv } from './compliance-filings.csv';

/**
 * Minimal structural type for the Express `Response` object — covers
 * the two methods the CSV endpoints need (setHeader, send). Avoids
 * adding `@types/express` to the domain's dev deps; the runtime object
 * is the same Express response Nest passes to `@Res()`.
 */
interface CsvResponse {
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
}

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

@Controller('compliance-filings/reports')
export class ComplianceFilingsReportsController {
  constructor(private readonly reports: ComplianceFilingsReportsService) {}

  @Get('trend')
  @RequirePermission('reports.read')
  getTrend(
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);
    return this.reports.getTrend({ from, to }, today, accessCtx);
  }

  @Get('by-client')
  @RequirePermission('reports.read')
  getByClient(
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
    return this.reports.getByClient({ from, to }, today, { q }, accessCtx);
  }

  @Get('aging')
  @RequirePermission('reports.read')
  getAging(
    @Query('today') todayParam: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    return this.reports.getOverdueAging(today, accessCtx);
  }

  @Get('severity')
  @RequirePermission('reports.read')
  getSeverity(
    @Query('today') todayParam: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    return this.reports.getOverdueSeverity(today, accessCtx);
  }

  /**
   * CSV export of the per-client compliance summary — same shape as
   * `/by-client`, no LIMIT (the date range is the bound). The endpoint
   * does not accept a `limit` parameter; the data-fetching rule
   * (`.claude/rules/data-fetching.md`) forbids one for full-result
   * exports.
   */
  @Get('compliance.csv')
  @RequirePermission('reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getComplianceCsv(
    @Res() res: CsvResponse,
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

    const rows = await this.reports.getByClient({ from, to }, today, { q }, accessCtx);

    const csv = toCsv(
      [
        'Client ID',
        'Client',
        'Total Filings',
        'On Time',
        'Late',
        'Overdue',
        'On-Time Rate (%)',
      ],
      rows.map((r) => [
        r.clientId,
        r.clientName,
        r.totalFilings,
        r.onTime,
        r.late,
        r.overdue,
        r.onTimeRate,
      ]),
    );

    res.setHeader('Content-Disposition', csvDisposition('compliance', today));
    res.send(csv);
  }

  /**
   * CSV export of the unbounded overdue filings list. Same predicate as
   * `GET /compliance-filings?bucket=overdue` (status not completed/cancelled,
   * dueDate < today) and same display joins — but no LIMIT. The on-screen
   * table renders the top 20 with a "View all N" affordance; this endpoint
   * is the "view all" path for operators who want the full list as a file.
   */
  @Get('overdue.csv')
  @RequirePermission('reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getOverdueCsv(
    @Res() res: CsvResponse,
    @Query('today') todayParam: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ): Promise<void> {
    const today = resolveCalendarDate(todayParam, resolveToday());

    const rows = await this.reports.listOverdueForExport(today, accessCtx);

    const assigneeName = (
      first: string | null,
      last: string | null,
    ): string => [first, last].filter(Boolean).join(' ');

    const csv = toCsv(
      [
        'Filing ID',
        'External Key',
        'Title',
        'Client',
        'Law Code',
        'Status',
        'Priority',
        'Due Date',
        'Days Overdue',
        'Period Start',
        'Period End',
        'Team',
        'Assignee',
      ],
      rows.map((r) => [
        r.id,
        r.externalKey ?? '',
        r.title,
        r.clientName,
        r.lawCode ?? '',
        r.status,
        r.priority,
        r.dueDate,
        r.daysOverdue,
        r.periodStart ?? '',
        r.periodEnd ?? '',
        r.assigneeTeamName ?? '',
        assigneeName(r.assigneeFirstName, r.assigneeLastName),
      ]),
    );

    res.setHeader('Content-Disposition', csvDisposition('overdue', today));
    res.send(csv);
  }
}
