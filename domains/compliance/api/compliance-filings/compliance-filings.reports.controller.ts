import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { todayInTimezone } from '@packages/common';
import { PdfGeneratorService } from '@packages/pdf-generator';
import {
  RequirePermission,
  buildAccessContext,
  type DataAccessContext,
} from '@packages/rbac';
import { ComplianceFilingsReportsService } from './compliance-filings.reports.service';
import { csvDisposition, toCsv } from './compliance-filings.csv';
import {
  pdfDisposition,
  pdfFooterHtml,
  renderCompliancePdf,
  renderOverduePdf,
} from './compliance-filings.pdf-templates';

/**
 * Minimal structural type for the Express `Response` object — covers
 * the methods the CSV + PDF endpoints need (setHeader, send). Avoids
 * adding `@types/express` to the domain's dev deps; the runtime object
 * is the same Express response Nest passes to `@Res()`. The CSV path
 * sends a string; the PDF path sends a Buffer (binary), so `send` is
 * typed as the union of both — the runtime accepts each.
 */
interface ReportResponse {
  setHeader: (name: string, value: string) => void;
  send: (body: string | Buffer) => void;
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

/**
 * Reports endpoints are gated on `reports.read` (the verb that controls
 * who can pull *any* report at all), but the rows being returned are
 * compliance filings — so the row-level scope must come from the user's
 * `compliance-filings.read` grant, not their `reports.read` one. Per
 * `.claude/rules/data-access-scope.md` § "No mixing scope concerns
 * across permission slugs", we build the access context manually here
 * with the right slug instead of letting the `@AccessContext` decorator
 * default to the handler's `@RequirePermission` slug.
 *
 * Returns `undefined` when the user holds no grant for the resource
 * permission — services treat that as "no scope filter" (matches the
 * `@AccessContext` decorator's existing semantics for unauthenticated
 * callers, which the upstream guard chain rejects before we get here).
 */
function filingsScopeContext(user: JwtPayload): DataAccessContext | undefined {
  return buildAccessContext(user, 'compliance-filings.read');
}

@Controller('compliance-filings/reports')
export class ComplianceFilingsReportsController {
  constructor(
    private readonly reports: ComplianceFilingsReportsService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  @Get('trend')
  @RequirePermission('reports.read')
  getTrend(
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);
    return this.reports.getTrend({ from, to }, today, filingsScopeContext(user));
  }

  @Get('by-client')
  @RequirePermission('reports.read')
  getByClient(
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);
    return this.reports.getByClient({ from, to }, today, { q }, filingsScopeContext(user));
  }

  @Get('aging')
  @RequirePermission('reports.read')
  getAging(
    @Query('today') todayParam: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    return this.reports.getOverdueAging(today, filingsScopeContext(user));
  }

  @Get('severity')
  @RequirePermission('reports.read')
  getSeverity(
    @Query('today') todayParam: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const today = resolveCalendarDate(todayParam, resolveToday());
    return this.reports.getOverdueSeverity(today, filingsScopeContext(user));
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
    @Res() res: ReportResponse,
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);

    const rows = await this.reports.getByClient({ from, to }, today, { q }, filingsScopeContext(user));

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
    @Res() res: ReportResponse,
    @Query('today') todayParam: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const today = resolveCalendarDate(todayParam, resolveToday());

    const rows = await this.reports.listOverdueForExport(today, filingsScopeContext(user));

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

  /**
   * PDF export of the per-client compliance summary — same data as
   * `/compliance.csv`, rendered as a portrait A4 PDF via Puppeteer.
   * No LIMIT (the date range is the bound). Does not accept a `limit`
   * parameter; the data-fetching rule forbids one for full-result
   * exports.
   */
  @Get('compliance.pdf')
  @RequirePermission('reports.read')
  @Header('Content-Type', 'application/pdf')
  async getCompliancePdf(
    @Res() res: ReportResponse,
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const today = resolveCalendarDate(todayParam, resolveToday());
    const range = defaultRange(today);
    const from = resolveCalendarDate(fromParam, range.from);
    const to = resolveCalendarDate(toParam, range.to);

    // Reuses the same service method that powers the CSV sibling — no
    // SQL duplication, same scope predicate, same shape of rows.
    const rows = await this.reports.getByClient({ from, to }, today, { q }, filingsScopeContext(user));

    const html = renderCompliancePdf({ rows, range: { from, to }, today });
    const pdfBuffer = await this.pdfGenerator.generatePdf(html, {
      format: 'A4',
      landscape: false,
      printBackground: true,
      footerHtml: pdfFooterHtml(),
    });

    res.setHeader('Content-Disposition', pdfDisposition('compliance', today));
    res.send(pdfBuffer);
  }

  /**
   * PDF export of the unbounded overdue filings list — same data as
   * `/overdue.csv`, rendered as a landscape A4 PDF (the column set is
   * wide). Same predicate as the on-screen table; same display joins
   * (clientName / lawCode / assignee labels) so the file is readable
   * without a side-fetch.
   */
  @Get('overdue.pdf')
  @RequirePermission('reports.read')
  @Header('Content-Type', 'application/pdf')
  async getOverduePdf(
    @Res() res: ReportResponse,
    @Query('today') todayParam: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const today = resolveCalendarDate(todayParam, resolveToday());

    const rows = await this.reports.listOverdueForExport(today, filingsScopeContext(user));

    const html = renderOverduePdf({ rows, today });
    const pdfBuffer = await this.pdfGenerator.generatePdf(html, {
      format: 'A4',
      landscape: true,
      printBackground: true,
      footerHtml: pdfFooterHtml(),
    });

    res.setHeader('Content-Disposition', pdfDisposition('overdue', today));
    res.send(pdfBuffer);
  }
}
