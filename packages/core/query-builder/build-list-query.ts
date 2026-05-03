import { asc, desc, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { withScope, withScopeIncludingDeleted } from '@packages/database';
import {
  buildFilterCondition,
  buildSearchCondition,
  parseFilterParam,
} from './query-builder';
import type { FilterExpression, ColumnMap, PaginationMeta } from './types';

/**
 * Caller-supplied options for `buildListQuery`. All fields are optional —
 * a list endpoint that doesn't expose search, filters, or sort can call
 * the helper with just `{}` and still get pagination + scope composed
 * into the same `withScope(...)` shape every other consumer uses.
 *
 * @see buildListQuery for the full contract.
 */
export interface BuildListQueryOptions {
  /**
   * Actor-scope predicate from `DataAccessScopeService.buildPredicate(...)`.
   * `undefined` means the caller has `'any'` scope (admin) or didn't pass
   * an `accessCtx` — composes as a no-op via `withScope`.
   */
  scopePredicate?: SQL;

  /**
   * Columns the caller wants ILIKE-OR'd against `query.search` when the
   * search param is a non-empty trimmed string. Anything outside this
   * list is structurally unsearchable. Empty / unset → search is a no-op.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchableColumns?: any[];

  /**
   * Whitelist of `{sortKey: column}` pairs. The frontend's `?sort=name`
   * resolves through this map; unknown keys fall back to `defaultSort`.
   * The whitelist is the structural answer to "which columns can a URL
   * sort by?" — there is no other defense against a hostile sort key.
   */
  sortableColumns?: ColumnMap;

  /**
   * Whitelist of `{filterField: column}` pairs. Drives BOTH the
   * structured `filters` JSON resolver AND the bare-passthrough id
   * filter. Filter keys that aren't in this map are silently dropped
   * (mirrors `compliance-filings` post-PR-1) so the frontend can send
   * extra params without 400-ing.
   */
  filterableColumns?: ColumnMap;

  /**
   * Sort key used when `query.sort` is missing or unknown. The named
   * field MUST exist in `sortableColumns` — if it doesn't, the helper
   * skips primary sort entirely and only emits the stable id tiebreaker.
   */
  defaultSort?: { field: string; order?: 'asc' | 'desc' };

  /** Pagination defaults (default: 25). */
  defaultLimit?: number;

  /** Pagination upper bound (default: 100). Higher requests clamp silently. */
  maxLimit?: number;

  /**
   * When true, soft-deleted rows are included via
   * `withScopeIncludingDeleted` instead of `withScope`. Tenant +
   * actor-scope still apply unchanged. Mirrors `query.includeDeleted`
   * but the caller is in charge of wiring that flag in (the helper
   * doesn't introspect the `query` object for `includeDeleted` — keeps
   * the behaviour explicit at the call site).
   */
  includeDeleted?: boolean;
}

/**
 * Output shape from `buildListQuery`. The helper produces query pieces;
 * the caller is responsible for plugging them into `db.select().from()`
 * and the matching `db.select({ total: count() }).from()` count query.
 *
 * `paginationMeta` is a function (not a baked value) because `total`
 * MUST come from a SQL `count()` round-trip — never `rows.length`.
 */
export interface BuildListQueryResult {
  /**
   * Composed WHERE clause: scope (tenant + soft-delete + actor-scope)
   * ANDed with structured filters, bare-id filters, and search. Pass
   * directly to BOTH the rows query and the count query so `meta.total`
   * matches the rendered page.
   */
  where: SQL | undefined;

  /**
   * ORDER BY arguments — primary sort followed by a stable
   * `asc(table.id)` tiebreaker. Spread into `.orderBy(...orderBy)`.
   */
  orderBy: SQL[];

  /** Clamped limit value to pass to `.limit(...)`. */
  limit: number;

  /** Computed offset (0-based) to pass to `.offset(...)`. */
  offset: number;

  /** Resolved page number (clamped to >= 1). */
  page: number;

  /**
   * Compute pagination metadata from the SQL `count()` total. Always
   * returns `totalPages >= 1` so empty result sets still render an
   * "of 1" page indicator. Never call this with `rows.length` — that's
   * the bug this helper exists to close.
   */
  paginationMeta: (total: number) => PaginationMeta;
}

/**
 * Loose query-input shape. Matches `BaseListQuery` from
 * `@packages/entity-engine` (the wide passthrough variant) plus the
 * narrower `BaseListQuery` from `@packages/crud-base`. Both shapes
 * route through here uniformly.
 */
export type ListQueryInput = Record<string, unknown>;

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_MAX_PAGE_SIZE = 100;

/**
 * Build a list query for a `db.select(...).from(table)...` chain.
 *
 * Composes — in one place — the four pieces that every server-side
 * list endpoint has to get right:
 *
 *  1. **Scope** — tenant + soft-delete via `withScope(table, ...)`,
 *     actor-scope via the caller-built `scopePredicate`. All three
 *     legs flow through the same WHERE.
 *  2. **Filters** — structured `query.filters` JSON parsed via
 *     `parseFilterParam`, plus bare passthrough params (`?clientId=…`)
 *     for any key in `filterableColumns`. Unknown filter fields are
 *     silently dropped — frontends can send extra params harmlessly.
 *  3. **Search** — when `query.search` is a non-empty trimmed string,
 *     OR'd ILIKE across `searchableColumns`. Empty / unset → no-op.
 *  4. **Sort + pagination** — `query.sort` resolves against the
 *     `sortableColumns` whitelist with `defaultSort` fallback and a
 *     stable `asc(table.id)` tiebreaker. `page` / `limit` are clamped
 *     to `[1, maxLimit]`.
 *
 * The helper does NOT execute the query — it returns the WHERE,
 * ORDER BY, LIMIT, OFFSET pieces and a `paginationMeta(total)`
 * factory. Callers run the rows query, then a SQL `count()` query
 * with the SAME `where` to feed `paginationMeta`. `meta.total` MUST
 * come from the count query — never `rows.length`. This is the
 * structural fix for the silent-filter / wrong-meta gap that
 * `BaseCrudService.list` cannot close on its own (joins + total
 * count vary per consumer).
 *
 * @example
 *   const built = buildListQuery(laws, query, {
 *     scopePredicate,
 *     searchableColumns: [laws.code, laws.name],
 *     sortableColumns: {
 *       code: laws.code,
 *       name: laws.name,
 *       createdAt: laws.createdAt,
 *     },
 *     filterableColumns: { jurisdiction: laws.jurisdiction },
 *     defaultSort: { field: 'code', order: 'asc' },
 *   });
 *
 *   const rows = await db.select().from(laws)
 *     .where(built.where)
 *     .orderBy(...built.orderBy)
 *     .limit(built.limit).offset(built.offset);
 *
 *   const [totalRow] = await db.select({ total: count() }).from(laws)
 *     .where(built.where);  // SAME where as rows query
 *
 *   return { data: rows, meta: built.paginationMeta(Number(totalRow.total)) };
 */
export function buildListQuery(
  table: PgTable,
  query: ListQueryInput,
  options: BuildListQueryOptions,
): BuildListQueryResult {
  const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_SIZE;
  const maxLimit = options.maxLimit ?? DEFAULT_MAX_PAGE_SIZE;

  // ── pagination ──────────────────────────────────────────────────
  // `?? defaultLimit` only kicks in when the caller didn't supply a
  // limit at all. A supplied value of 0 / negative / NaN is honored
  // as "explicit but invalid" and clamps up to 1 — same behaviour
  // BaseCrudService.list documents in its docstring.
  const limitRaw = toFiniteNumber(query.limit) ?? defaultLimit;
  const limit = Math.max(1, Math.min(Math.floor(limitRaw), maxLimit));
  const pageRaw = toFiniteNumber(query.page) ?? 1;
  const page = Math.max(1, Math.floor(pageRaw));
  const offset = (page - 1) * limit;

  // ── filter predicates ───────────────────────────────────────────
  const filterPredicates: SQL[] = [];
  const filterable = options.filterableColumns ?? {};

  // Structured `filters` JSON — the canonical filter channel. The
  // controller's `query.filters` is a string at this point (URL-coded
  // JSON). `parseFilterParam` is a no-op for non-strings / unparseable
  // input, so we don't need to type-guard here beyond the typeof check.
  if (typeof query.filters === 'string' && query.filters.length > 0) {
    const expressions = parseFilterParam(query.filters);
    for (const expr of expressions) {
      const column = filterable[expr.field];
      if (!column) continue; // unknown field — silently dropped
      filterPredicates.push(buildFilterCondition(column, expr));
    }
  }

  // Bare passthrough id filters — any URL param whose key matches a
  // `filterableColumns` entry becomes an `eq` predicate. This is the
  // belt-and-braces channel for stale clients that send filters as
  // query params instead of via the structured `filters` JSON. System
  // params (page / limit / search / sort / order / includeDeleted /
  // filters) are never honored as filters, even if a frontend
  // accidentally adds a column with one of those names.
  for (const field of Object.keys(filterable)) {
    if (RESERVED_QUERY_KEYS.has(field)) continue;
    const value = query[field];
    if (!isEqValue(value)) continue;
    filterPredicates.push(
      buildFilterCondition(filterable[field], { field, operator: 'eq', value }),
    );
  }

  // ── search predicate ────────────────────────────────────────────
  const searchPredicate = resolveSearchPredicate(
    query.search,
    options.searchableColumns,
  );
  const allFilterPredicates = searchPredicate
    ? [...filterPredicates, searchPredicate]
    : filterPredicates;

  // ── compose WHERE via the canonical scope primitive ─────────────
  const scopeFn = options.includeDeleted ? withScopeIncludingDeleted : withScope;
  const where = scopeFn(table, options.scopePredicate, ...allFilterPredicates);

  // ── ORDER BY (whitelisted column + stable id tiebreaker) ────────
  const orderBy = buildOrderClauses(table, query, options);

  // ── paginationMeta factory (caller supplies SQL count()) ────────
  const paginationMeta = (total: number): PaginationMeta => {
    const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
    return {
      page,
      limit,
      total: safeTotal,
      totalPages: Math.max(1, Math.ceil(safeTotal / limit)),
    };
  };

  return { where, orderBy, limit, offset, page, paginationMeta };
}

// ────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────

const RESERVED_QUERY_KEYS = new Set<string>([
  'page',
  'limit',
  'search',
  'sort',
  'order',
  'includeDeleted',
  'filters',
]);

/**
 * Coerce a URL-string or numeric input into a finite number. Returns
 * `undefined` only when the input is genuinely missing — `0` and
 * negatives flow through and get clamped by the caller. This matters
 * for the pagination contract: a caller that explicitly sends
 * `limit=0` should clamp to 1, not silently fall back to defaultLimit.
 */
function toFiniteNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/**
 * Determine whether a bare URL param is a usable `eq` filter value. We
 * accept strings (the URL norm), numbers, and booleans — anything else
 * is dropped to avoid silently coercing arrays / objects / nulls.
 */
function isEqValue(value: unknown): value is string | number | boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.length > 0;
  return typeof value === 'number' || typeof value === 'boolean';
}

function resolveSearchPredicate(
  search: unknown,
  searchableColumns: BuildListQueryOptions['searchableColumns'],
): SQL | undefined {
  if (typeof search !== 'string') return undefined;
  const trimmed = search.trim();
  if (trimmed.length === 0) return undefined;
  if (!searchableColumns || searchableColumns.length === 0) return undefined;
  return buildSearchCondition(trimmed, searchableColumns) ?? undefined;
}

function buildOrderClauses(
  table: PgTable,
  query: ListQueryInput,
  options: BuildListQueryOptions,
): SQL[] {
  const sortable = options.sortableColumns ?? {};
  const sortKey = typeof query.sort === 'string' ? query.sort : undefined;
  const orderRaw = typeof query.order === 'string' ? query.order : undefined;

  // Resolve the primary sort. If the caller's `query.sort` matches a
  // whitelisted column, use it with `query.order`. Otherwise fall back
  // to `defaultSort` (also looked up in the whitelist — the field name
  // must be a valid sortable key for the fallback to fire).
  let primaryColumn = sortKey ? sortable[sortKey] : undefined;
  let direction: 'asc' | 'desc' =
    orderRaw === 'desc' || orderRaw === 'asc' ? orderRaw : 'asc';

  if (!primaryColumn && options.defaultSort) {
    primaryColumn = sortable[options.defaultSort.field];
    direction = options.defaultSort.order === 'desc' ? 'desc' : 'asc';
  }

  const clauses: SQL[] = [];
  if (primaryColumn) {
    clauses.push(direction === 'desc' ? desc(primaryColumn) : asc(primaryColumn));
  }
  // Stable tiebreaker on the table's id column so paginated results
  // don't shuffle when the primary sort key has duplicates. A table
  // without an id column will throw at runtime — every consumer of
  // this helper has a `TableWithId` table by convention.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idColumn = (table as any).id;
  if (idColumn) {
    clauses.push(asc(idColumn));
  }

  return clauses;
}
