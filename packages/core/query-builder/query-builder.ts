import { eq, ne, gt, gte, lt, lte, isNull, isNotNull, ilike, or, asc, desc, inArray, notInArray, between, and, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type {
  FilterExpression,
  FilterOperator,
  ColumnMap,
  SortDirection,
  PaginationParams,
  PaginationResult,
  PaginationMeta,
} from './types';
import { SYSTEM_QUERY_PARAMS } from './types';

/**
 * Build a single WHERE condition from a FilterExpression applied to a column.
 */
export function buildFilterCondition(column: any, expression: FilterExpression): SQL {
  const { operator, value } = expression;

  switch (operator) {
    case 'eq':
      return eq(column, value as any);
    case 'neq':
      return ne(column, value as any);
    case 'gt':
      return gt(column, value as any);
    case 'gte':
      return gte(column, value as any);
    case 'lt':
      return lt(column, value as any);
    case 'lte':
      return lte(column, value as any);
    case 'like':
      return ilike(column, `%${value}%`);
    case 'in': {
      const arr = Array.isArray(value) ? value : [value];
      return inArray(column, arr as any[]);
    }
    case 'notIn': {
      const arr = Array.isArray(value) ? value : [value];
      return notInArray(column, arr as any[]);
    }
    case 'isNull':
      return isNull(column);
    case 'isNotNull':
      return isNotNull(column);
    case 'between': {
      const [min, max] = value as [any, any];
      return between(column, min, max);
    }
    case 'contains':
      // JSON array containment: column::jsonb ? value
      return sql`${column}::jsonb ? ${String(value)}`;
    default:
      return eq(column, value as any);
  }
}

/**
 * Build WHERE conditions from an array of FilterExpressions.
 * Resolves each field to a column via the columnMap.
 * Returns resolved conditions and unresolved filters (for EAV/hook routing).
 */
export function buildFilterConditions(
  expressions: FilterExpression[],
  columnMap: ColumnMap,
): { conditions: SQL[]; unresolved: FilterExpression[] } {
  const conditions: SQL[] = [];
  const unresolved: FilterExpression[] = [];

  for (const expr of expressions) {
    const column = columnMap[expr.field];
    if (column) {
      conditions.push(buildFilterCondition(column, expr));
    } else {
      unresolved.push(expr);
    }
  }

  return { conditions, unresolved };
}

/**
 * Build a search condition (OR of ILIKE across multiple columns).
 */
export function buildSearchCondition(term: string, columns: any[]): SQL | null {
  if (!term || columns.length === 0) return null;
  const pattern = `%${term}%`;
  const conditions = columns.map((col) => ilike(col, pattern));
  return conditions.length === 1 ? conditions[0] : or(...conditions)!;
}

/**
 * Build ORDER BY expression from a sort key and direction.
 * Falls back to defaultSort if sortKey is not in sortableColumns.
 */
export function buildSortExpression(
  sortKey: string,
  direction: SortDirection,
  sortableColumns: ColumnMap,
  defaultSort: string,
): any {
  const orderFn = direction === 'asc' ? asc : desc;
  const column = sortableColumns[sortKey] ?? sortableColumns[defaultSort];
  if (!column) return undefined;
  return orderFn(column);
}

/**
 * Compute pagination offset from page and limit.
 */
export function computePagination(params: PaginationParams): PaginationResult {
  const page = Math.max(1, params.page);
  const limit = Math.max(1, params.limit);
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

/**
 * Compute pagination metadata from total count.
 */
export function computePaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

/**
 * Parse legacy query params (?status=active) into FilterExpression[].
 * Strips system params and converts remaining key=value pairs to eq filters.
 */
export function parseLegacyFilters(query: Record<string, unknown>): FilterExpression[] {
  const filters: FilterExpression[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (SYSTEM_QUERY_PARAMS.has(key)) continue;
    if (value == null || value === '') continue;
    filters.push({ field: key, operator: 'eq', value });
  }
  return filters;
}

const VALID_OPERATORS = new Set<FilterOperator>([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like',
  'in', 'notIn', 'isNull', 'isNotNull', 'between', 'contains',
]);

/**
 * Parse the structured `filters` query param (JSON string) into FilterExpression[].
 * Validates shape and returns empty array on invalid input.
 */
export function parseFilterParam(filtersParam: string): FilterExpression[] {
  if (!filtersParam) return [];
  try {
    const parsed = JSON.parse(filtersParam);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f: any) =>
        f &&
        typeof f.field === 'string' &&
        typeof f.operator === 'string' &&
        VALID_OPERATORS.has(f.operator),
    );
  } catch {
    return [];
  }
}

/**
 * Merge legacy filters with structured filters.
 * Structured filters take precedence for the same field.
 */
export function mergeFilters(
  legacy: FilterExpression[],
  structured: FilterExpression[],
): FilterExpression[] {
  if (structured.length === 0) return legacy;
  if (legacy.length === 0) return structured;

  const structuredFields = new Set(structured.map((f) => f.field));
  const merged = legacy.filter((f) => !structuredFields.has(f.field));
  return [...merged, ...structured];
}
