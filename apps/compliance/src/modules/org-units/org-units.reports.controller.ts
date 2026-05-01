import { Controller, Get, Query } from '@nestjs/common';
import { todayInTimezone } from '@packages/common';
import { AccessContext, RequirePermission, type DataAccessContext } from '@packages/rbac';
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
}
