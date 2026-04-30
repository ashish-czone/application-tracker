import { describe, it, expect } from 'vitest';
import { translateFilingsQuery, __test__ } from '../compliance-filings-query';

const { FILINGS_LIST_DEFAULT_LIMIT, FILINGS_LIST_MAX_LIMIT, NOT_COMPLETED_STATES } = __test__;

function parseFilters(out: { filters?: string }): Array<{ field: string; operator: string; value: unknown }> {
  if (!out.filters) return [];
  return JSON.parse(out.filters);
}

describe('translateFilingsQuery — limits', () => {
  it('applies the default limit when none is supplied', () => {
    const out = translateFilingsQuery({});
    expect(out.limit).toBe(FILINGS_LIST_DEFAULT_LIMIT);
  });

  it('caps a high limit at the max', () => {
    const out = translateFilingsQuery({ limit: 5000 });
    expect(out.limit).toBe(FILINGS_LIST_MAX_LIMIT);
  });

  it('falls back to default for invalid limits', () => {
    expect(translateFilingsQuery({ limit: 'NaN' }).limit).toBe(FILINGS_LIST_DEFAULT_LIMIT);
    expect(translateFilingsQuery({ limit: '-5' }).limit).toBe(FILINGS_LIST_DEFAULT_LIMIT);
    expect(translateFilingsQuery({ limit: 0 }).limit).toBe(FILINGS_LIST_DEFAULT_LIMIT);
  });

  it('honours a small valid limit', () => {
    expect(translateFilingsQuery({ limit: 5 }).limit).toBe(5);
  });
});

describe('translateFilingsQuery — date filters', () => {
  it('translates dueBefore into a lte filter on dueDate', () => {
    const out = translateFilingsQuery({ dueBefore: '2026-04-30' });
    expect(parseFilters(out)).toEqual([
      { field: 'dueDate', operator: 'lte', value: '2026-04-30' },
    ]);
  });

  it('translates dueAfter into a gte filter on dueDate', () => {
    const out = translateFilingsQuery({ dueAfter: '2026-04-01' });
    expect(parseFilters(out)).toEqual([
      { field: 'dueDate', operator: 'gte', value: '2026-04-01' },
    ]);
  });

  it('combines dueBefore and dueAfter for a window', () => {
    const out = translateFilingsQuery({ dueAfter: '2026-04-01', dueBefore: '2026-04-30' });
    expect(parseFilters(out)).toEqual([
      { field: 'dueDate', operator: 'lte', value: '2026-04-30' },
      { field: 'dueDate', operator: 'gte', value: '2026-04-01' },
    ]);
  });
});

describe('translateFilingsQuery — status filters', () => {
  it('translates notCompleted=true to in-filter excluding completed/cancelled', () => {
    const out = translateFilingsQuery({ notCompleted: 'true' });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'in', value: NOT_COMPLETED_STATES },
    ]);
  });

  it('translates a single status to eq', () => {
    const out = translateFilingsQuery({ status: 'pending' });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'eq', value: 'pending' },
    ]);
  });

  it('translates a comma-separated status list to in', () => {
    const out = translateFilingsQuery({ status: 'pending,in_progress,review' });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'in', value: ['pending', 'in_progress', 'review'] },
    ]);
  });

  it('layers notCompleted and explicit status filters', () => {
    const out = translateFilingsQuery({ notCompleted: 'true', status: 'in_progress' });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'in', value: NOT_COMPLETED_STATES },
      { field: 'status', operator: 'eq', value: 'in_progress' },
    ]);
  });
});

describe('translateFilingsQuery — sort', () => {
  it('parses sort=field:asc into sort + order', () => {
    const out = translateFilingsQuery({ sort: 'dueDate:asc' });
    expect(out.sort).toBe('dueDate');
    expect(out.order).toBe('asc');
  });

  it('parses sort=field:desc into sort + order', () => {
    const out = translateFilingsQuery({ sort: 'dueDate:desc' });
    expect(out.sort).toBe('dueDate');
    expect(out.order).toBe('desc');
  });

  it('still accepts separate sort and order params', () => {
    const out = translateFilingsQuery({ sort: 'dueDate', order: 'asc' });
    expect(out.sort).toBe('dueDate');
    expect(out.order).toBe('asc');
  });
});

describe('translateFilingsQuery — pass-through filters', () => {
  it('preserves equality filters as legacy params for the engine to interpret', () => {
    const out = translateFilingsQuery({
      clientId: 'client-1',
      lawId: 'law-1',
      assigneeId: 'user-1',
      assigneeTeamId: 'team-1',
    });
    expect(out.clientId).toBe('client-1');
    expect(out.lawId).toBe('law-1');
    expect(out.assigneeId).toBe('user-1');
    expect(out.assigneeTeamId).toBe('team-1');
  });

  it('drops empty values from pass-through', () => {
    const out = translateFilingsQuery({ clientId: '', lawId: 'law-1' });
    expect(out.clientId).toBeUndefined();
    expect(out.lawId).toBe('law-1');
  });

  it('preserves search', () => {
    const out = translateFilingsQuery({ search: 'q1 filing' });
    expect(out.search).toBe('q1 filing');
  });
});

describe('translateFilingsQuery — existing structured filters', () => {
  it('merges the engine-style filters JSON with the shorthand-derived filters', () => {
    const existing = JSON.stringify([{ field: 'priority', operator: 'eq', value: 'high' }]);
    const out = translateFilingsQuery({
      filters: existing,
      dueBefore: '2026-04-30',
    });
    expect(parseFilters(out)).toEqual([
      { field: 'priority', operator: 'eq', value: 'high' },
      { field: 'dueDate', operator: 'lte', value: '2026-04-30' },
    ]);
  });

  it('drops malformed filters JSON gracefully', () => {
    const out = translateFilingsQuery({
      filters: 'not-json',
      notCompleted: 'true',
    });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'in', value: NOT_COMPLETED_STATES },
    ]);
  });
});

describe('translateFilingsQuery — pagination + flags', () => {
  it('honours includeDeleted only when string "true"', () => {
    expect(translateFilingsQuery({ includeDeleted: 'true' }).includeDeleted).toBe(true);
    expect(translateFilingsQuery({ includeDeleted: 'false' }).includeDeleted).toBe(false);
    expect(translateFilingsQuery({}).includeDeleted).toBe(false);
  });

  it('coerces page to a number', () => {
    expect(translateFilingsQuery({ page: '3' }).page).toBe(3);
    expect(translateFilingsQuery({ page: 2 }).page).toBe(2);
    expect(translateFilingsQuery({}).page).toBeUndefined();
  });
});
