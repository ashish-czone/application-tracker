import { describe, it, expect } from 'vitest';
import { __test__ } from '../useFilingsList';

const { bucketToQueryParams, buildFilingsListQueryString, addDays, prevDay } = __test__;

describe('addDays / prevDay', () => {
  it('adds and subtracts days correctly across month rollover', () => {
    expect(addDays('2026-04-30', 7)).toBe('2026-05-07');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(prevDay('2026-04-01')).toBe('2026-03-31');
  });
});

describe('bucketToQueryParams', () => {
  const today = '2026-04-30';

  it('translates "overdue" into notCompleted + dueBefore=yesterday', () => {
    expect(bucketToQueryParams('overdue', today)).toEqual({
      notCompleted: 'true',
      dueBefore: '2026-04-29',
    });
  });

  it('translates "due-today" into notCompleted + a single-day window', () => {
    expect(bucketToQueryParams('due-today', today)).toEqual({
      notCompleted: 'true',
      dueAfter: '2026-04-29',
      dueBefore: '2026-04-30',
    });
  });

  it('translates "due-this-week" into the next-7-day window', () => {
    expect(bucketToQueryParams('due-this-week', today)).toEqual({
      notCompleted: 'true',
      dueAfter: '2026-04-30',
      dueBefore: '2026-05-07',
    });
  });

  it('translates "upcoming" into notCompleted + dueAfter=today+7', () => {
    expect(bucketToQueryParams('upcoming', today)).toEqual({
      notCompleted: 'true',
      dueAfter: '2026-05-07',
    });
  });

  it('translates "filed" / "cancelled" into status filters', () => {
    expect(bucketToQueryParams('filed', today)).toEqual({ status: 'completed' });
    expect(bucketToQueryParams('cancelled', today)).toEqual({ status: 'cancelled' });
  });

  it('returns no params when bucket is undefined', () => {
    expect(bucketToQueryParams(undefined, today)).toEqual({});
  });
});

describe('buildFilingsListQueryString', () => {
  it('serialises pagination, sort, search, and bucket together', () => {
    const qs = buildFilingsListQueryString({
      page: 2,
      limit: 25,
      sort: 'dueDate:asc',
      search: 'tax',
      bucket: 'overdue',
      today: '2026-04-30',
    });
    const params = new URLSearchParams(qs);
    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('25');
    expect(params.get('sort')).toBe('dueDate:asc');
    expect(params.get('search')).toBe('tax');
    expect(params.get('notCompleted')).toBe('true');
    expect(params.get('dueBefore')).toBe('2026-04-29');
  });

  it('emits an in-filter for clientIds when present', () => {
    const qs = buildFilingsListQueryString({
      clientIds: ['c1', 'c2'],
      today: '2026-04-30',
    });
    const params = new URLSearchParams(qs);
    const filters = JSON.parse(params.get('filters') ?? '[]') as Array<Record<string, unknown>>;
    expect(filters).toContainEqual({ field: 'clientId', operator: 'in', value: ['c1', 'c2'] });
  });

  it('layers clientIds, lawIds, and assigneeTeamIds without overwriting each other', () => {
    const qs = buildFilingsListQueryString({
      clientIds: ['c1'],
      lawIds: ['l1', 'l2'],
      assigneeTeamIds: ['t1'],
      today: '2026-04-30',
    });
    const params = new URLSearchParams(qs);
    const filters = JSON.parse(params.get('filters') ?? '[]') as Array<Record<string, unknown>>;
    expect(filters).toHaveLength(3);
    expect(filters.map((f) => f.field)).toEqual(['clientId', 'lawId', 'assigneeTeamId']);
  });

  it('omits search and sort when not supplied', () => {
    const qs = buildFilingsListQueryString({ today: '2026-04-30' });
    const params = new URLSearchParams(qs);
    expect(params.get('search')).toBeNull();
    expect(params.get('sort')).toBeNull();
  });
});
