import { describe, it, expect } from 'vitest';
import { __test__ } from '../useFilingsByDueWindow';

const { toCalendarDate, buildQueryString } = __test__;

describe('toCalendarDate', () => {
  it('formats a Date in local timezone as YYYY-MM-DD', () => {
    const d = new Date(2026, 3, 30); // April 30 2026 local
    expect(toCalendarDate(d)).toBe('2026-04-30');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5); // Jan 5 2026 local
    expect(toCalendarDate(d)).toBe('2026-01-05');
  });
});

describe('buildQueryString', () => {
  it('emits notCompleted as a literal string when truthy', () => {
    expect(buildQueryString({ notCompleted: true })).toBe('notCompleted=true');
  });

  it('omits notCompleted when false or absent', () => {
    expect(buildQueryString({ notCompleted: false })).toBe('');
    expect(buildQueryString({})).toBe('');
  });

  it('serialises a full overdue window query', () => {
    const qs = buildQueryString({
      notCompleted: true,
      dueBefore: '2026-04-30',
      sort: 'dueDate:asc',
      limit: 5,
    });
    expect(qs).toBe('dueBefore=2026-04-30&notCompleted=true&sort=dueDate%3Aasc&limit=5');
  });

  it('serialises a full upcoming window query', () => {
    const qs = buildQueryString({
      notCompleted: true,
      dueAfter: '2026-04-30',
      dueBefore: '2026-05-07',
      sort: 'dueDate:asc',
      limit: 8,
    });
    expect(qs).toBe('dueBefore=2026-05-07&dueAfter=2026-04-30&notCompleted=true&sort=dueDate%3Aasc&limit=8');
  });
});
