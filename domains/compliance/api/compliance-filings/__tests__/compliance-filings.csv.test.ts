import { describe, it, expect } from 'vitest';
import {
  csvDisposition,
  csvEscape,
  csvRow,
  toCsv,
} from '../compliance-filings.csv';

/**
 * Unit tests for the RFC 4180 CSV helpers used by the report-export
 * controllers. Anything that changes the escaping rules — or the
 * Content-Disposition filename shape — needs a test here.
 */
describe('compliance-filings.csv', () => {
  describe('csvEscape', () => {
    it('renders null and undefined as empty strings', () => {
      expect(csvEscape(null)).toBe('');
      expect(csvEscape(undefined)).toBe('');
    });

    it('passes plain strings through unchanged', () => {
      expect(csvEscape('Acme Corp')).toBe('Acme Corp');
      expect(csvEscape('IT-194Q')).toBe('IT-194Q');
    });

    it('quotes values containing a comma', () => {
      expect(csvEscape('Acme, Inc.')).toBe('"Acme, Inc."');
    });

    it('quotes values containing a newline', () => {
      expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
      expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
    });

    it('quotes and doubles internal quotes', () => {
      expect(csvEscape('She said "hi"')).toBe('"She said ""hi"""');
    });

    it('stringifies non-string scalars', () => {
      expect(csvEscape(42)).toBe('42');
      expect(csvEscape(0)).toBe('0');
      expect(csvEscape(true)).toBe('true');
    });
  });

  describe('csvRow', () => {
    it('joins escaped values with commas', () => {
      const row = csvRow(['Acme', 'High', 5, 'has, comma']);
      expect(row).toBe('Acme,High,5,"has, comma"');
    });
  });

  describe('toCsv', () => {
    it('renders headers + rows separated by CRLF and a trailing newline', () => {
      const csv = toCsv(
        ['Client', 'Total'],
        [
          ['Acme', 5],
          ['Globex', 3],
        ],
      );
      expect(csv).toBe('Client,Total\r\nAcme,5\r\nGlobex,3\r\n');
    });

    it('escapes header and row values that contain CSV-special characters', () => {
      const csv = toCsv(
        ['Title', 'Notes'],
        [['Quarterly Filing', 'Has "quoted" word, and a comma']],
      );
      expect(csv).toBe(
        'Title,Notes\r\nQuarterly Filing,"Has ""quoted"" word, and a comma"\r\n',
      );
    });

    it('renders an empty body when there are no data rows', () => {
      const csv = toCsv(['A', 'B'], []);
      expect(csv).toBe('A,B\r\n');
    });
  });

  describe('csvDisposition', () => {
    it('formats Content-Disposition with the tab and date stamp', () => {
      expect(csvDisposition('overdue', '2026-05-03')).toBe(
        'attachment; filename="overdue-report-2026-05-03.csv"',
      );
      expect(csvDisposition('compliance', '2026-04-30')).toBe(
        'attachment; filename="compliance-report-2026-04-30.csv"',
      );
    });
  });
});
