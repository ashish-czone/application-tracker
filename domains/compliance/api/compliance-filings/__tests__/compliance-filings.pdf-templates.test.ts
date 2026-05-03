import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  pdfDisposition,
  pdfFooterHtml,
  renderCompliancePdf,
  renderOverduePdf,
  renderTeamWorkloadPdf,
} from '../compliance-filings.pdf-templates';
import type {
  ClientBreakdownRow,
  OverdueFilingExportRow,
} from '../compliance-filings.reports.service';

/**
 * Unit tests for the HTML templates that drive the PDF report exports.
 * The templates are pure string-renderers; if the structural shape of
 * the output (header, table, escaping, page-number tokens) drifts, a
 * test here catches it before Puppeteer renders something garbled.
 */
describe('compliance-filings.pdf-templates', () => {
  describe('escapeHtml', () => {
    it('renders null and undefined as empty strings', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('passes plain strings through unchanged', () => {
      expect(escapeHtml('Acme Corp')).toBe('Acme Corp');
    });

    it('escapes the five canonical HTML characters', () => {
      expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
      expect(escapeHtml(`he said "ok"`)).toBe('he said &quot;ok&quot;');
      expect(escapeHtml(`it's fine`)).toBe('it&#39;s fine');
    });

    it('encodes & before < / > so existing entity references stay distinct', () => {
      // The order matters — naive replacement of `<` first would turn
      // `&lt;` into `&amp;lt;`. Keep this test pinned.
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('&amp; literal')).toBe('&amp;amp; literal');
    });

    it('stringifies non-string scalars', () => {
      expect(escapeHtml(42)).toBe('42');
      expect(escapeHtml(0)).toBe('0');
      expect(escapeHtml(true)).toBe('true');
    });
  });

  describe('pdfDisposition', () => {
    it('formats Content-Disposition with the tab and date stamp', () => {
      expect(pdfDisposition('overdue', '2026-05-03')).toBe(
        'attachment; filename="overdue-report-2026-05-03.pdf"',
      );
      expect(pdfDisposition('compliance', '2026-04-30')).toBe(
        'attachment; filename="compliance-report-2026-04-30.pdf"',
      );
      expect(pdfDisposition('workload', '2026-04-30')).toBe(
        'attachment; filename="workload-report-2026-04-30.pdf"',
      );
    });
  });

  describe('pdfFooterHtml', () => {
    it('includes the Puppeteer page-number tokens', () => {
      const footer = pdfFooterHtml();
      expect(footer).toContain('<span class="pageNumber">');
      expect(footer).toContain('<span class="totalPages">');
      expect(footer).toContain('<span class="date">');
    });
  });

  describe('renderCompliancePdf', () => {
    const range = { from: '2026-01-01', to: '2026-04-30' };
    const today = '2026-04-30';

    it('renders a valid HTML document with the report header and table', () => {
      const rows: ClientBreakdownRow[] = [
        {
          clientId: 'c1',
          clientName: 'Acme Corp',
          totalFilings: 10,
          onTime: 8,
          late: 1,
          overdue: 1,
          onTimeRate: 80,
        },
      ];

      const html = renderCompliancePdf({ rows, range, today });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Compliance summary by client');
      expect(html).toContain('Generated 2026-04-30');
      expect(html).toContain('Range 2026-01-01 to 2026-04-30');
      expect(html).toContain('Acme Corp');
      expect(html).toContain('80%');
    });

    it('escapes HTML special characters in client names', () => {
      const rows: ClientBreakdownRow[] = [
        {
          clientId: 'c1',
          clientName: '<script>alert("xss")</script>',
          totalFilings: 1,
          onTime: 1,
          late: 0,
          overdue: 0,
          onTimeRate: 100,
        },
      ];

      const html = renderCompliancePdf({ rows, range, today });

      // The literal injected payload should not appear unescaped.
      expect(html).not.toContain('<script>alert');
      // The escaped form does.
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('renders an empty-state when there are no rows', () => {
      const html = renderCompliancePdf({ rows: [], range, today });
      expect(html).toContain('No filings in the selected date range');
      expect(html).not.toContain('<table');
    });

    it('falls back to em-dash when client name is empty', () => {
      const rows: ClientBreakdownRow[] = [
        {
          clientId: 'c1',
          clientName: '',
          totalFilings: 1,
          onTime: 1,
          late: 0,
          overdue: 0,
          onTimeRate: 100,
        },
      ];
      const html = renderCompliancePdf({ rows, range, today });
      expect(html).toContain('<td>—</td>');
    });
  });

  describe('renderOverduePdf', () => {
    const today = '2026-04-30';

    it('renders the overdue table with all column labels', () => {
      const rows: OverdueFilingExportRow[] = [
        {
          id: 'f1',
          title: 'Quarterly TDS Q4',
          externalKey: 'TDS-2026-Q4-001',
          clientId: 'c1',
          clientName: 'Acme Corp',
          lawId: 'l1',
          lawCode: 'TDS-194Q',
          status: 'pending',
          priority: 'high',
          dueDate: '2026-04-01',
          daysOverdue: 29,
          assigneeTeamId: 't1',
          assigneeTeamName: 'GST Team',
          assigneeId: 'u1',
          assigneeFirstName: 'Alice',
          assigneeLastName: 'Smith',
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
        },
      ];

      const html = renderOverduePdf({ rows, today });

      expect(html).toContain('Currently overdue filings');
      expect(html).toContain('As of 2026-04-30');
      expect(html).toContain('TDS-2026-Q4-001');
      expect(html).toContain('Quarterly TDS Q4');
      expect(html).toContain('Acme Corp');
      expect(html).toContain('TDS-194Q');
      expect(html).toContain('Alice Smith');
      expect(html).toContain('GST Team');
      expect(html).toContain('29');
    });

    it('escapes special characters in title and client name', () => {
      const rows: OverdueFilingExportRow[] = [
        {
          id: 'f1',
          title: 'Q4 "Special" filing & report',
          externalKey: null,
          clientId: 'c1',
          clientName: 'Acme, Inc. <Holdings>',
          lawId: 'l1',
          lawCode: null,
          status: 'pending',
          priority: 'high',
          dueDate: '2026-04-01',
          daysOverdue: 29,
          assigneeTeamId: null,
          assigneeTeamName: null,
          assigneeId: null,
          assigneeFirstName: null,
          assigneeLastName: null,
          periodStart: null,
          periodEnd: null,
        },
      ];

      const html = renderOverduePdf({ rows, today });

      expect(html).toContain('Q4 &quot;Special&quot; filing &amp; report');
      expect(html).toContain('Acme, Inc. &lt;Holdings&gt;');
    });

    it('renders empty-state when no overdue filings', () => {
      const html = renderOverduePdf({ rows: [], today });
      expect(html).toContain('No overdue filings as of 2026-04-30');
    });

    it('joins assignee first + last names with a space; null parts skipped', () => {
      const rows: OverdueFilingExportRow[] = [
        {
          id: 'f1',
          title: 't',
          externalKey: null,
          clientId: 'c1',
          clientName: 'c',
          lawId: 'l1',
          lawCode: null,
          status: 'pending',
          priority: 'high',
          dueDate: '2026-04-01',
          daysOverdue: 1,
          assigneeTeamId: null,
          assigneeTeamName: null,
          assigneeId: null,
          assigneeFirstName: 'Bob',
          assigneeLastName: null,
          periodStart: null,
          periodEnd: null,
        },
      ];

      const html = renderOverduePdf({ rows, today });
      // Only first name renders, no trailing space artifact.
      expect(html).toContain('<td>Bob</td>');
    });
  });

  describe('renderTeamWorkloadPdf', () => {
    const range = { from: '2026-01-01', to: '2026-04-30' };
    const today = '2026-04-30';

    it('renders the team workload table', () => {
      const html = renderTeamWorkloadPdf({
        rows: [
          {
            assigneeTeamId: 't1',
            assigneeTeamName: 'GST Team',
            totalAssigned: 12,
            completed: 9,
            inProgress: 2,
            overdue: 1,
            onTimeRate: 86,
          },
        ],
        range,
        today,
      });

      expect(html).toContain('Team workload');
      expect(html).toContain('GST Team');
      expect(html).toContain('86%');
    });

    it('escapes team names containing HTML characters', () => {
      const html = renderTeamWorkloadPdf({
        rows: [
          {
            assigneeTeamId: 't1',
            assigneeTeamName: 'A & B <Team>',
            totalAssigned: 1,
            completed: 0,
            inProgress: 1,
            overdue: 0,
            onTimeRate: 0,
          },
        ],
        range,
        today,
      });
      expect(html).toContain('A &amp; B &lt;Team&gt;');
    });

    it('renders empty-state when no rows', () => {
      const html = renderTeamWorkloadPdf({ rows: [], range, today });
      expect(html).toContain('No team activity in the selected date range');
    });
  });
});
