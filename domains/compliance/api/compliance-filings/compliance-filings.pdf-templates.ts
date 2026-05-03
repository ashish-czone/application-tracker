/**
 * HTML templates for the report PDF exports — siblings of the CSV
 * helpers in `compliance-filings.csv.ts`. Each builder takes the
 * already-fetched rows (the same shape the CSV controller consumes)
 * and produces a self-contained HTML document. The PDF provider
 * (Puppeteer) renders the HTML to a Buffer.
 *
 * Inlined here (not in `@packages/common`) for the same reasons the
 * CSV helpers are: the formatting is trivial, no other consumer needs
 * them today, and platform packages stay free of domain logic per
 * `.claude/rules/confirm-package-changes.md`.
 *
 * The templates use plain string interpolation — no JSX, no React-PDF,
 * no Mustache. Print-friendly inline styling lives in the document
 * `<style>` block. Page numbers come from the PDF provider's
 * `displayHeaderFooter` mechanism via `pdfFooterHtml()` below.
 */

import type { ClientBreakdownRow, OverdueFilingExportRow } from './compliance-filings.reports.service';

/** Per-team workload row — mirrors the shape the org-units reports compose. */
export interface TeamWorkloadPdfRow {
  assigneeTeamId: string;
  assigneeTeamName: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  onTimeRate: number;
}

/**
 * Escape user-supplied text for HTML interpolation. Covers the five
 * canonical characters (`&`, `<`, `>`, `"`, `'`). Sufficient for the
 * row values we render — they go inside `<td>` text nodes and never
 * inside attribute values that need URL or JS-context escaping.
 *
 * Inlined rather than added to `@packages/common` because (a) only
 * this domain needs it and (b) `confirm-package-changes.md` requires
 * a confirmation before introducing cross-cutting utilities. If a
 * second domain ever needs it, lift verbatim.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Filename for `Content-Disposition: attachment` on a PDF export —
 * sibling to `csvDisposition` in `compliance-filings.csv.ts`.
 *
 * Example: `attachment; filename="overdue-report-2026-05-03.pdf"`
 */
export function pdfDisposition(tab: string, today: string): string {
  return `attachment; filename="${tab}-report-${today}.pdf"`;
}

/**
 * The footer template Puppeteer renders on every page. Uses the
 * standard `<span class="pageNumber">` / `<span class="totalPages">`
 * tokens Puppeteer substitutes at print time.
 *
 * Note: Puppeteer's footer template runs in an isolated context with
 * its own (very small) default font size. We set our own here so the
 * footer is legible.
 */
export function pdfFooterHtml(): string {
  return `
    <div style="font-size:8px; width:100%; padding:0 15mm; color:#666; display:flex; justify-content:space-between; font-family:Helvetica,Arial,sans-serif;">
      <span>Compliance report — generated <span class="date"></span></span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `;
}

/**
 * Shared CSS for all three report PDFs. Tailwind isn't available
 * in the headless browser context — semantic tokens get inlined as
 * raw colour values for the print stylesheet only.
 */
const REPORT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10px;
    line-height: 1.4;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  header.report-header {
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  header.report-header .eyebrow {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 4px;
  }
  header.report-header h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px 0;
  }
  header.report-header .meta {
    font-size: 9px;
    color: #666;
  }
  table.report-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  table.report-table thead th {
    background: #f5f5f5;
    border-bottom: 1px solid #1a1a1a;
    padding: 6px 8px;
    text-align: left;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #1a1a1a;
  }
  table.report-table tbody td {
    border-bottom: 1px solid #e5e5e5;
    padding: 6px 8px;
    vertical-align: top;
  }
  table.report-table td.numeric,
  table.report-table th.numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .empty-state {
    padding: 24px 0;
    text-align: center;
    color: #999;
    font-style: italic;
  }
`;

interface ReportHeaderInput {
  /** Eyebrow above the title, e.g. "COMPLIANCE REPORT". */
  eyebrow: string;
  /** Main title, e.g. "Compliance summary by client". */
  title: string;
  /** Calendar date the report is "as of", `YYYY-MM-DD`. */
  generatedOn: string;
  /** Optional context line (e.g. date range, scope). */
  meta?: string;
}

function renderHeader(input: ReportHeaderInput): string {
  const meta = input.meta ? ` &middot; ${escapeHtml(input.meta)}` : '';
  return `
    <header class="report-header">
      <div class="eyebrow">${escapeHtml(input.eyebrow)}</div>
      <h1>${escapeHtml(input.title)}</h1>
      <div class="meta">Generated ${escapeHtml(input.generatedOn)}${meta}</div>
    </header>
  `;
}

function wrapDocument(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Compliance Report</title>
  <style>${REPORT_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/**
 * PDF template for the per-client compliance breakdown — the PDF
 * sibling of `GET /compliance-filings/reports/compliance.csv`.
 * Same row shape, same column set, ordered by total filings DESC
 * (the service already orders that way).
 */
export function renderCompliancePdf(input: {
  rows: ReadonlyArray<ClientBreakdownRow>;
  range: { from: string; to: string };
  today: string;
}): string {
  const headerHtml = renderHeader({
    eyebrow: 'Compliance report',
    title: 'Compliance summary by client',
    generatedOn: input.today,
    meta: `Range ${input.range.from} to ${input.range.to}`,
  });

  const tableHtml =
    input.rows.length === 0
      ? `<p class="empty-state">No filings in the selected date range.</p>`
      : `
        <table class="report-table">
          <thead>
            <tr>
              <th>Client</th>
              <th class="numeric">Total Filings</th>
              <th class="numeric">On Time</th>
              <th class="numeric">Late</th>
              <th class="numeric">Overdue</th>
              <th class="numeric">On-Time Rate</th>
            </tr>
          </thead>
          <tbody>
            ${input.rows
              .map(
                (r) => `
              <tr>
                <td>${escapeHtml(r.clientName || '—')}</td>
                <td class="numeric">${r.totalFilings}</td>
                <td class="numeric">${r.onTime}</td>
                <td class="numeric">${r.late}</td>
                <td class="numeric">${r.overdue}</td>
                <td class="numeric">${r.onTimeRate}%</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      `;

  return wrapDocument(headerHtml + tableHtml);
}

/**
 * PDF template for the unbounded overdue filings list — the PDF
 * sibling of `GET /compliance-filings/reports/overdue.csv`.
 *
 * Wide column set; recommended PDF orientation is landscape.
 */
export function renderOverduePdf(input: {
  rows: ReadonlyArray<OverdueFilingExportRow>;
  today: string;
}): string {
  const headerHtml = renderHeader({
    eyebrow: 'Overdue report',
    title: 'Currently overdue filings',
    generatedOn: input.today,
    meta: `As of ${input.today}`,
  });

  const assigneeName = (
    first: string | null,
    last: string | null,
  ): string => [first, last].filter(Boolean).join(' ');

  const tableHtml =
    input.rows.length === 0
      ? `<p class="empty-state">No overdue filings as of ${escapeHtml(input.today)}.</p>`
      : `
        <table class="report-table">
          <thead>
            <tr>
              <th>External Key</th>
              <th>Title</th>
              <th>Client</th>
              <th>Law</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due</th>
              <th class="numeric">Days Overdue</th>
              <th>Team</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            ${input.rows
              .map(
                (r) => `
              <tr>
                <td>${escapeHtml(r.externalKey ?? '')}</td>
                <td>${escapeHtml(r.title)}</td>
                <td>${escapeHtml(r.clientName)}</td>
                <td>${escapeHtml(r.lawCode ?? '')}</td>
                <td>${escapeHtml(r.status)}</td>
                <td>${escapeHtml(r.priority)}</td>
                <td>${escapeHtml(r.dueDate)}</td>
                <td class="numeric">${r.daysOverdue}</td>
                <td>${escapeHtml(r.assigneeTeamName ?? '')}</td>
                <td>${escapeHtml(assigneeName(r.assigneeFirstName, r.assigneeLastName))}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      `;

  return wrapDocument(headerHtml + tableHtml);
}

/**
 * PDF template for the team workload report — the PDF sibling of
 * `GET /org-units/reports/team-workload.csv`. Lives at the domain
 * layer (alongside the CSV helpers) so the app-level controller can
 * consume the same set of templates without re-implementing the CSS
 * + header chrome.
 */
export function renderTeamWorkloadPdf(input: {
  rows: ReadonlyArray<TeamWorkloadPdfRow>;
  range: { from: string; to: string };
  today: string;
}): string {
  const headerHtml = renderHeader({
    eyebrow: 'Workload report',
    title: 'Team workload',
    generatedOn: input.today,
    meta: `Range ${input.range.from} to ${input.range.to}`,
  });

  const tableHtml =
    input.rows.length === 0
      ? `<p class="empty-state">No team activity in the selected date range.</p>`
      : `
        <table class="report-table">
          <thead>
            <tr>
              <th>Team</th>
              <th class="numeric">Total Assigned</th>
              <th class="numeric">Completed</th>
              <th class="numeric">In Progress</th>
              <th class="numeric">Overdue</th>
              <th class="numeric">On-Time Rate</th>
            </tr>
          </thead>
          <tbody>
            ${input.rows
              .map(
                (r) => `
              <tr>
                <td>${escapeHtml(r.assigneeTeamName || '—')}</td>
                <td class="numeric">${r.totalAssigned}</td>
                <td class="numeric">${r.completed}</td>
                <td class="numeric">${r.inProgress}</td>
                <td class="numeric">${r.overdue}</td>
                <td class="numeric">${r.onTimeRate}%</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      `;

  return wrapDocument(headerHtml + tableHtml);
}
