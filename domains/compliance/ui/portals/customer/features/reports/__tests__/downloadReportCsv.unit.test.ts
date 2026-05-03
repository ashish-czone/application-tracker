import { describe, it, expect } from 'vitest';
import { parseDispositionFilename } from '../downloadReportCsv';

describe('parseDispositionFilename', () => {
  it('extracts filename from RFC 6266 quoted form', () => {
    expect(
      parseDispositionFilename(
        'attachment; filename="overdue-report-2026-05-03.csv"',
      ),
    ).toBe('overdue-report-2026-05-03.csv');
  });

  it('returns null when the header is empty', () => {
    expect(parseDispositionFilename('')).toBe(null);
  });

  it('returns null when the header has no filename param', () => {
    expect(parseDispositionFilename('attachment')).toBe(null);
  });

  it('does not match the older unquoted form', () => {
    // We control the server and emit the quoted form unconditionally.
    expect(
      parseDispositionFilename('attachment; filename=foo.csv'),
    ).toBe(null);
  });
});
