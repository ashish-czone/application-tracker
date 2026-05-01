import { describe, it, expect } from 'vitest';
import { FilingsListQuerySchema } from '../compliance-filings.dto';
import { buildBaseListQuery, expandBucketAlias } from '../compliance-filings.filters';

const NOT_COMPLETED_STATES = ['pending', 'in_progress', 'review', 'rejected'];
const TODAY = '2026-04-30';

/**
 * End-to-end test of the list-query pipeline: raw URL → Zod schema → domain
 * translator → entity-engine BaseListQuery. Asserts what the engine actually
 * sees so changes anywhere in the pipeline that drop or distort filters
 * surface immediately.
 */
function buildQuery(raw: Record<string, unknown>, today: string = TODAY) {
  return buildBaseListQuery(FilingsListQuerySchema.parse(raw), today);
}

function parseFilters(out: { filters?: string }): Array<{ field: string; operator: string; value: unknown }> {
  if (!out.filters) return [];
  return JSON.parse(out.filters);
}

describe('buildBaseListQuery — date filters', () => {
  it('translates dueBefore into a lte filter on dueDate', () => {
    const out = buildQuery({ dueBefore: '2026-04-30' });
    expect(parseFilters(out)).toEqual([
      { field: 'dueDate', operator: 'lte', value: '2026-04-30' },
    ]);
  });

  it('translates dueAfter into a gte filter on dueDate', () => {
    const out = buildQuery({ dueAfter: '2026-04-01' });
    expect(parseFilters(out)).toEqual([
      { field: 'dueDate', operator: 'gte', value: '2026-04-01' },
    ]);
  });

  it('combines dueBefore and dueAfter for a window', () => {
    const out = buildQuery({ dueAfter: '2026-04-01', dueBefore: '2026-04-30' });
    expect(parseFilters(out)).toEqual([
      { field: 'dueDate', operator: 'lte', value: '2026-04-30' },
      { field: 'dueDate', operator: 'gte', value: '2026-04-01' },
    ]);
  });
});

describe('buildBaseListQuery — status filters', () => {
  it('translates notCompleted=true to in-filter excluding completed/cancelled', () => {
    const out = buildQuery({ notCompleted: 'true' });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'in', value: NOT_COMPLETED_STATES },
    ]);
  });

  it('translates a single status to eq', () => {
    const out = buildQuery({ status: 'pending' });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'eq', value: 'pending' },
    ]);
  });

  it('translates a comma-separated status list to in', () => {
    const out = buildQuery({ status: 'pending,in_progress,review' });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'in', value: ['pending', 'in_progress', 'review'] },
    ]);
  });

  it('layers notCompleted and explicit status filters', () => {
    const out = buildQuery({ notCompleted: 'true', status: 'in_progress' });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'in', value: NOT_COMPLETED_STATES },
      { field: 'status', operator: 'eq', value: 'in_progress' },
    ]);
  });
});

describe('buildBaseListQuery — pass-through engine fields', () => {
  it('preserves equality filters as legacy params for the engine to interpret', () => {
    const out = buildQuery({
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
    const out = buildQuery({ clientId: '', lawId: 'law-1' });
    expect(out.clientId).toBeUndefined();
    expect(out.lawId).toBe('law-1');
  });

  it('preserves search', () => {
    const out = buildQuery({ search: 'q1 filing' });
    expect(out.search).toBe('q1 filing');
  });
});

describe('buildBaseListQuery — existing structured filters', () => {
  it('merges the engine-style filters JSON with the shorthand-derived filters', () => {
    const existing = JSON.stringify([{ field: 'priority', operator: 'eq', value: 'high' }]);
    const out = buildQuery({
      filters: existing,
      dueBefore: '2026-04-30',
    });
    expect(parseFilters(out)).toEqual([
      { field: 'priority', operator: 'eq', value: 'high' },
      { field: 'dueDate', operator: 'lte', value: '2026-04-30' },
    ]);
  });

  it('drops malformed filters JSON gracefully', () => {
    const out = buildQuery({
      filters: 'not-json',
      notCompleted: 'true',
    });
    expect(parseFilters(out)).toEqual([
      { field: 'status', operator: 'in', value: NOT_COMPLETED_STATES },
    ]);
  });
});

describe('expandBucketAlias', () => {
  function expand(raw: Record<string, unknown>, today: string = TODAY) {
    return expandBucketAlias(FilingsListQuerySchema.parse(raw), today);
  }

  it('passes parsed input through unchanged when bucket is missing', () => {
    const out = expand({ clientId: 'c1' });
    expect(out.bucket).toBeUndefined();
    expect(out.clientId).toBe('c1');
  });

  it('drops an unrecognised bucket value but keeps everything else', () => {
    const out = expand({ bucket: 'bogus', clientId: 'c1' });
    expect(out.bucket).toBeUndefined();
    expect(out.clientId).toBe('c1');
  });

  it('overdue: notCompleted=true, dueBefore=yesterday (strict before today)', () => {
    const out = expand({ bucket: 'overdue' });
    expect(out.bucket).toBeUndefined();
    expect(out.notCompleted).toBe(true);
    expect(out.dueBefore).toBe('2026-04-29');
  });

  it('due-today: notCompleted=true, dueBefore=today AND dueAfter=today', () => {
    const out = expand({ bucket: 'due-today' });
    expect(out.notCompleted).toBe(true);
    expect(out.dueBefore).toBe(TODAY);
    expect(out.dueAfter).toBe(TODAY);
  });

  it('upcoming: notCompleted=true, dueAfter=tomorrow (strict after today)', () => {
    const out = expand({ bucket: 'upcoming' });
    expect(out.notCompleted).toBe(true);
    expect(out.dueAfter).toBe('2026-05-01');
  });

  it('filed: status=[completed], no date constraints', () => {
    const out = expand({ bucket: 'filed' });
    expect(out.status).toEqual(['completed']);
    expect(out.dueBefore).toBeUndefined();
    expect(out.dueAfter).toBeUndefined();
  });

  it('preserves clientId / page / limit / sort alongside bucket expansion', () => {
    const out = expand({
      bucket: 'overdue',
      clientId: 'c1',
      page: 2,
      limit: 10,
      sort: 'dueDate:asc',
    });
    expect(out.clientId).toBe('c1');
    expect(out.page).toBe(2);
    expect(out.limit).toBe(10);
    expect(out.sort).toBe('dueDate');
    expect(out.order).toBe('asc');
    expect(out.notCompleted).toBe(true);
    expect(out.dueBefore).toBe('2026-04-29');
  });
});
