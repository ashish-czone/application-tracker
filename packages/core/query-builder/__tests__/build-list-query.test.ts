import { describe, it, expect } from 'vitest';
import { pgTable, text, date, PgDialect } from 'drizzle-orm/pg-core';
import { eq, type SQL } from 'drizzle-orm';
import { buildListQuery } from '../build-list-query';

// ---------------------------------------------------------------------------
// Test fixture: a minimal Drizzle table. The helper introspects the table
// for `id` (tiebreaker) and feeds it through `withScope`, so we use a real
// pgTable rather than a hand-rolled mock — keeps the SQL real and the
// Drizzle internals honest. `createdAt` is a `date` column with mode:'string'
// so range filters can use plain ISO date strings (a `timestamp` column
// would expect `Date` objects and break the lte/gte string assertion).
// ---------------------------------------------------------------------------

const things = pgTable('things', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  status: text('status'),
  clientId: text('client_id'),
  createdAt: date('created_at', { mode: 'string' }).notNull(),
});

const dialect = new PgDialect();
function compile(value: SQL | undefined): { sql: string; params: unknown[] } {
  if (!value) return { sql: '', params: [] };
  return dialect.sqlToQuery(value);
}

// ---------------------------------------------------------------------------
// pagination
// ---------------------------------------------------------------------------
describe('buildListQuery — pagination', () => {
  it('uses the default limit when none is supplied', () => {
    const built = buildListQuery(things, {}, {});
    expect(built.limit).toBe(25);
    expect(built.page).toBe(1);
    expect(built.offset).toBe(0);
  });

  it('honors caller-supplied defaultLimit', () => {
    const built = buildListQuery(things, {}, { defaultLimit: 50 });
    expect(built.limit).toBe(50);
  });

  it('clamps limit above maxLimit (default 100)', () => {
    const built = buildListQuery(things, { limit: 999 }, {});
    expect(built.limit).toBe(100);
  });

  it('honors caller-supplied maxLimit', () => {
    const built = buildListQuery(things, { limit: 999 }, { maxLimit: 200 });
    expect(built.limit).toBe(200);
  });

  it('clamps limit below 1 to 1', () => {
    const built = buildListQuery(things, { limit: 0 }, {});
    expect(built.limit).toBe(1);
  });

  it('clamps page below 1 to 1', () => {
    const built = buildListQuery(things, { page: 0 }, {});
    expect(built.page).toBe(1);
    expect(built.offset).toBe(0);
  });

  it('computes offset from page and limit', () => {
    const built = buildListQuery(things, { page: 3, limit: 10 }, {});
    expect(built.offset).toBe(20);
  });

  it('parses string-encoded page and limit (URL params)', () => {
    const built = buildListQuery(things, { page: '4', limit: '10' }, {});
    expect(built.page).toBe(4);
    expect(built.limit).toBe(10);
    expect(built.offset).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// paginationMeta
// ---------------------------------------------------------------------------
describe('buildListQuery — paginationMeta', () => {
  it('computes totalPages from a SQL count() total', () => {
    const built = buildListQuery(things, { page: 1, limit: 25 }, {});
    expect(built.paginationMeta(100)).toEqual({
      page: 1,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
  });

  it('rounds up totalPages with a remainder', () => {
    const built = buildListQuery(things, { page: 1, limit: 25 }, {});
    expect(built.paginationMeta(101).totalPages).toBe(5);
  });

  it('returns totalPages >= 1 even for zero total', () => {
    const built = buildListQuery(things, { page: 1, limit: 25 }, {});
    expect(built.paginationMeta(0)).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 1,
    });
  });

  it('coerces non-finite totals to 0 (defensive)', () => {
    const built = buildListQuery(things, { page: 1, limit: 25 }, {});
    expect(built.paginationMeta(Number.NaN).total).toBe(0);
    expect(built.paginationMeta(Number.NaN).totalPages).toBe(1);
  });

  it('floors fractional totals (count() should always be integer, but defensive)', () => {
    const built = buildListQuery(things, { page: 1, limit: 25 }, {});
    expect(built.paginationMeta(10.7).total).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// filters JSON
// ---------------------------------------------------------------------------
describe('buildListQuery — filters JSON', () => {
  it('translates an eq predicate into a column = value WHERE clause', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'active' },
        ]),
      },
      { filterableColumns: { status: things.status } },
    );
    const compiled = compile(built.where);
    expect(compiled.sql).toContain('"status"');
    expect(compiled.params).toContain('active');
  });

  it('translates an in predicate into IN (...)', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'clientId', operator: 'in', value: ['c1', 'c2'] },
        ]),
      },
      { filterableColumns: { clientId: things.clientId } },
    );
    const compiled = compile(built.where);
    expect(compiled.sql).toMatch(/in\s*\(/i);
    expect(compiled.sql).toContain('"client_id"');
    expect(compiled.params).toEqual(expect.arrayContaining(['c1', 'c2']));
  });

  it('translates lte and gte predicates (range)', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'createdAt', operator: 'gte', value: '2026-01-01' },
          { field: 'createdAt', operator: 'lte', value: '2026-12-31' },
        ]),
      },
      { filterableColumns: { createdAt: things.createdAt } },
    );
    const compiled = compile(built.where);
    expect(compiled.sql).toMatch(/<=|>=/);
    expect(compiled.params).toEqual(
      expect.arrayContaining(['2026-01-01', '2026-12-31']),
    );
  });

  it('silently drops filters whose field is not in the whitelist', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'mysteryField', operator: 'eq', value: 'whatever' },
          { field: 'status', operator: 'eq', value: 'active' },
        ]),
      },
      { filterableColumns: { status: things.status } },
    );
    const compiled = compile(built.where);
    expect(compiled.sql).not.toContain('mystery');
    expect(compiled.sql).not.toContain('mystery_field');
    expect(compiled.params).toContain('active');
  });

  it('returns no filter predicates when filters JSON is malformed', () => {
    const built = buildListQuery(
      things,
      { filters: 'not-json' },
      { filterableColumns: { status: things.status } },
    );
    // The `where` may still have scope/tenant predicates from withScope, but
    // it should not contain a bound parameter for a parsed filter value.
    const compiled = compile(built.where);
    expect(compiled.params).not.toContain('not-json');
  });

  it('returns no filter predicates when filterableColumns is empty', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'active' },
        ]),
      },
      {},
    );
    const compiled = compile(built.where);
    expect(compiled.params).not.toContain('active');
  });
});

// ---------------------------------------------------------------------------
// bare passthrough id filters
// ---------------------------------------------------------------------------
describe('buildListQuery — bare passthrough filters', () => {
  it('honors a bare URL param matching a filterableColumns key', () => {
    const built = buildListQuery(
      things,
      { clientId: 'c-bare' },
      { filterableColumns: { clientId: things.clientId } },
    );
    const compiled = compile(built.where);
    expect(compiled.sql).toContain('"client_id"');
    expect(compiled.params).toContain('c-bare');
  });

  it('combines bare filter with structured filters (both honored)', () => {
    const built = buildListQuery(
      things,
      {
        clientId: 'c-bare',
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'active' },
        ]),
      },
      {
        filterableColumns: {
          clientId: things.clientId,
          status: things.status,
        },
      },
    );
    const compiled = compile(built.where);
    expect(compiled.params).toEqual(expect.arrayContaining(['c-bare', 'active']));
  });

  it('ignores bare params for keys that match reserved system params', () => {
    // Even if the caller registers `page` as a filterable column (degenerate),
    // a `page=2` URL param must not become a filter predicate. The reserved
    // set protects this.
    const built = buildListQuery(
      things,
      { page: 2, limit: 10 },
      { filterableColumns: { page: things.id } },
    );
    const compiled = compile(built.where);
    expect(compiled.params).not.toContain(2);
    // Pagination still works as expected.
    expect(built.page).toBe(2);
    expect(built.limit).toBe(10);
  });

  it('ignores empty-string and null bare values', () => {
    const built = buildListQuery(
      things,
      { clientId: '', status: null as unknown },
      {
        filterableColumns: {
          clientId: things.clientId,
          status: things.status,
        },
      },
    );
    const compiled = compile(built.where);
    expect(compiled.params).not.toContain('');
    expect(compiled.params).not.toContain(null);
  });
});

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------
describe('buildListQuery — search', () => {
  it('OR-composes ILIKE across searchableColumns when search is non-empty', () => {
    const built = buildListQuery(
      things,
      { search: 'gst' },
      { searchableColumns: [things.code, things.name] },
    );
    const compiled = compile(built.where);
    expect(compiled.sql).toMatch(/ilike/i);
    expect(compiled.sql).toContain('"code"');
    expect(compiled.sql).toContain('"name"');
    expect(compiled.params).toContain('%gst%');
  });

  it('treats empty / whitespace search as no-op', () => {
    const built = buildListQuery(
      things,
      { search: '   ' },
      { searchableColumns: [things.code, things.name] },
    );
    const compiled = compile(built.where);
    expect(compiled.sql).not.toMatch(/ilike/i);
  });

  it('ignores search when no searchableColumns are configured', () => {
    const built = buildListQuery(things, { search: 'gst' }, {});
    const compiled = compile(built.where);
    expect(compiled.sql).not.toMatch(/ilike/i);
  });

  it('ignores non-string search values', () => {
    const built = buildListQuery(
      things,
      { search: 42 },
      { searchableColumns: [things.code, things.name] },
    );
    const compiled = compile(built.where);
    expect(compiled.sql).not.toMatch(/ilike/i);
  });
});

// ---------------------------------------------------------------------------
// sort
// ---------------------------------------------------------------------------
describe('buildListQuery — sort', () => {
  it('renders ORDER BY against a whitelisted sort key', () => {
    const built = buildListQuery(
      things,
      { sort: 'code', order: 'desc' },
      { sortableColumns: { code: things.code, name: things.name } },
    );
    expect(built.orderBy.length).toBe(2); // primary + id tiebreaker
    const primary = compile(built.orderBy[0]);
    expect(primary.sql).toContain('"code"');
    expect(primary.sql).toMatch(/desc/i);
  });

  it('appends a stable id ASC tiebreaker', () => {
    const built = buildListQuery(
      things,
      { sort: 'name', order: 'asc' },
      { sortableColumns: { name: things.name } },
    );
    const tiebreaker = compile(built.orderBy[1]);
    expect(tiebreaker.sql).toContain('"id"');
    expect(tiebreaker.sql).toMatch(/asc/i);
  });

  it('falls back to defaultSort when sort key is unknown', () => {
    const built = buildListQuery(
      things,
      { sort: 'mystery' },
      {
        sortableColumns: { code: things.code },
        defaultSort: { field: 'code', order: 'desc' },
      },
    );
    const primary = compile(built.orderBy[0]);
    expect(primary.sql).toContain('"code"');
    expect(primary.sql).toMatch(/desc/i);
  });

  it('falls back to defaultSort when sort is missing', () => {
    const built = buildListQuery(
      things,
      {},
      {
        sortableColumns: { code: things.code },
        defaultSort: { field: 'code' },
      },
    );
    const primary = compile(built.orderBy[0]);
    expect(primary.sql).toContain('"code"');
    expect(primary.sql).toMatch(/asc/i); // default direction
  });

  it('emits only the id tiebreaker when neither sort nor defaultSort resolve', () => {
    const built = buildListQuery(things, { sort: 'mystery' }, {});
    expect(built.orderBy.length).toBe(1);
    const only = compile(built.orderBy[0]);
    expect(only.sql).toContain('"id"');
  });

  it('defaults order to asc when not provided', () => {
    const built = buildListQuery(
      things,
      { sort: 'code' },
      { sortableColumns: { code: things.code } },
    );
    const primary = compile(built.orderBy[0]);
    expect(primary.sql).toMatch(/asc/i);
  });

  it('ignores invalid order values (treats as asc)', () => {
    const built = buildListQuery(
      things,
      { sort: 'code', order: 'sideways' },
      { sortableColumns: { code: things.code } },
    );
    const primary = compile(built.orderBy[0]);
    expect(primary.sql).toMatch(/asc/i);
  });
});

// ---------------------------------------------------------------------------
// scope predicate
// ---------------------------------------------------------------------------
describe('buildListQuery — scope predicate', () => {
  it('ANDs the actor-scope predicate into the WHERE alongside filters', () => {
    // Use a real predicate (eq on a column) so the compiled SQL contains a
    // recognisable shape — we just need to verify it flows through.
    const scopePredicate = eq(things.id, 'scope-marker-id');

    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'active' },
        ]),
      },
      {
        scopePredicate,
        filterableColumns: { status: things.status },
      },
    );
    const compiled = compile(built.where);
    expect(compiled.params).toEqual(
      expect.arrayContaining(['scope-marker-id', 'active']),
    );
  });

  it('omitting scopePredicate still composes filters into a valid WHERE', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'active' },
        ]),
      },
      { filterableColumns: { status: things.status } },
    );
    const compiled = compile(built.where);
    expect(compiled.params).toContain('active');
  });
});

// ---------------------------------------------------------------------------
// includeDeleted
// ---------------------------------------------------------------------------
describe('buildListQuery — includeDeleted', () => {
  // The fixture table doesn't have soft-delete columns, so withScope vs
  // withScopeIncludingDeleted produce structurally identical SQL — the
  // test focuses on the helper composing filters correctly under both
  // flags rather than asserting on Drizzle's compiled form.
  it('still composes filter predicates when includeDeleted is true', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'active' },
        ]),
      },
      {
        includeDeleted: true,
        filterableColumns: { status: things.status },
      },
    );
    const compiled = compile(built.where);
    expect(compiled.params).toContain('active');
  });

  it('default includeDeleted=false still composes filter predicates', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'active' },
        ]),
      },
      { filterableColumns: { status: things.status } },
    );
    const compiled = compile(built.where);
    expect(compiled.params).toContain('active');
  });
});

// ---------------------------------------------------------------------------
// integration: same WHERE for rows + count
// ---------------------------------------------------------------------------
describe('buildListQuery — WHERE shared across rows and count', () => {
  it('returns one `where` SQL object suitable for both rows and count queries', () => {
    const built = buildListQuery(
      things,
      {
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'pending' },
        ]),
        search: 'gst',
      },
      {
        filterableColumns: { status: things.status },
        searchableColumns: [things.name, things.code],
      },
    );

    // The contract is: caller passes `built.where` to both queries. We
    // verify the structural contents don't drift between two compilations
    // of the same SQL object — i.e. the helper hands back a stable handle,
    // not a stateful builder that mutates.
    const a = compile(built.where);
    const b = compile(built.where);
    expect(a.sql).toBe(b.sql);
    expect(a.params).toEqual(b.params);
  });
});
