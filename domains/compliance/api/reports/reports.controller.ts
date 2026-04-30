import { Controller, Get, Query } from '@nestjs/common';
import { todayInTimezone } from '@packages/common';
import { RequirePermission } from '@packages/rbac';
import { ComplianceReportsService } from './reports.service';

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

@Controller('compliance-reports')
export class ComplianceReportsController {
  constructor(private readonly reports: ComplianceReportsService) {}

  @Get('trend')
  @RequirePermission('reports.read')
  getTrend(
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);
    return this.reports.getTrend({ from, to }, today);
  }

  @Get('by-client')
  @RequirePermission('reports.read')
  getByClient(
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);
    return this.reports.getByClient({ from, to }, today, { q });
  }

  @Get('aging')
  @RequirePermission('reports.read')
  getAging(@Query('today') todayParam: string | undefined) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    return this.reports.getOverdueAging(today);
  }

  @Get('severity')
  @RequirePermission('reports.read')
  getSeverity(@Query('today') todayParam: string | undefined) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    return this.reports.getOverdueSeverity(today);
  }

  @Get('team-workload')
  @RequirePermission('reports.read')
  getTeamWorkload(
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);
    return this.reports.getTeamWorkload({ from, to }, today, { q });
  }
}
