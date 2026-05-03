import { describe, it, expect } from 'vitest';
import { __test__ } from '../useFilingsRange';

const { buildRangeQueryString } = __test__;

describe('buildRangeQueryString', () => {
  it('emits the dueAfter/dueBefore window with page + limit', () => {
    const qs = buildRangeQueryString({
      dueAfter: '2026-04-01',
      dueBefore: '2026-04-30',
      page: 2,
      limit: 100,
    });
    const params = new URLSearchParams(qs);
    expect(params.get('dueAfter')).toBe('2026-04-01');
    expect(params.get('dueBefore')).toBe('2026-04-30');
    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('100');
  });

  it('layers clientIds, lawIds, and assigneeTeamIds as in-filters', () => {
    const qs = buildRangeQueryString({
      dueAfter: '2026-04-01',
      dueBefore: '2026-04-30',
      page: 1,
      limit: 100,
      clientIds: ['c1', 'c2'],
      lawIds: ['l1'],
      assigneeTeamIds: ['t1', 't2'],
    });
    const params = new URLSearchParams(qs);
    const filters = JSON.parse(params.get('filters') ?? '[]') as Array<Record<string, unknown>>;
    expect(filters).toHaveLength(3);
    expect(filters.map((f) => f.field)).toEqual(['clientId', 'lawId', 'assigneeTeamId']);
  });

  it('omits filters when no in-arrays are passed', () => {
    const qs = buildRangeQueryString({
      dueAfter: '2026-04-01',
      dueBefore: '2026-04-30',
      page: 1,
      limit: 100,
    });
    const params = new URLSearchParams(qs);
    expect(params.get('filters')).toBeNull();
  });

  it('forwards search and sort when provided', () => {
    const qs = buildRangeQueryString({
      dueAfter: '2026-04-01',
      dueBefore: '2026-04-30',
      page: 1,
      limit: 100,
      sort: 'dueDate:asc',
      search: 'gst',
    });
    const params = new URLSearchParams(qs);
    expect(params.get('sort')).toBe('dueDate:asc');
    expect(params.get('search')).toBe('gst');
  });
});
