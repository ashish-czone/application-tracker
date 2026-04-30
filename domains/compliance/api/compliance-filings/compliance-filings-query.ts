import type { BaseListQuery } from '@packages/entity-engine';
import { parseFilterParam } from '@packages/query-builder';

const FILINGS_LIST_DEFAULT_LIMIT = 20;
const FILINGS_LIST_MAX_LIMIT = 100;

const NOT_COMPLETED_STATES = ['pending', 'in_progress', 'review', 'rejected'];

const SHORTHAND_KEYS = new Set([
  'dueBefore',
  'dueAfter',
  'notCompleted',
  'status',
  'sort',
]);

interface StructuredFilter {
  field: string;
  operator: string;
  value: unknown;
}

/**
 * Translate compliance-filings shorthand URL params into the entity engine's
 * BaseListQuery shape — converting `dueBefore`, `dueAfter`, `notCompleted`,
 * comma-separated `status`, and `sort=field:dir` into the structured `filters`
 * JSON the engine consumes via `parseFilterParam`. Pass-through filters
 * (clientId, lawId, ruleId, assigneeId, assigneeTeamId) are handled by the
 * engine's `parseLegacyFilters` and don't need translation here.
 *
 * Limit is capped at 100 to prevent the silent-truncation pattern this
 * project's data-fetching rule prohibits.
 */
export function translateFilingsQuery(raw: Record<string, unknown>): BaseListQuery {
  const limit = clampLimit(raw.limit);
  const page = raw.page ? Number(raw.page) : undefined;
  const includeDeleted = raw.includeDeleted === 'true';

  const { sort, order } = parseSort(raw.sort, raw.order);

  const shorthandFilters: StructuredFilter[] = [];

  const dueBefore = stringOrUndefined(raw.dueBefore);
  if (dueBefore) {
    shorthandFilters.push({ field: 'dueDate', operator: 'lte', value: dueBefore });
  }

  const dueAfter = stringOrUndefined(raw.dueAfter);
  if (dueAfter) {
    shorthandFilters.push({ field: 'dueDate', operator: 'gte', value: dueAfter });
  }

  if (raw.notCompleted === 'true' || raw.notCompleted === true) {
    shorthandFilters.push({
      field: 'status',
      operator: 'in',
      value: NOT_COMPLETED_STATES,
    });
  }

  const statusValues = parseCsv(raw.status);
  if (statusValues.length > 0) {
    shorthandFilters.push({
      field: 'status',
      operator: statusValues.length === 1 ? 'eq' : 'in',
      value: statusValues.length === 1 ? statusValues[0] : statusValues,
    });
  }

  const existingFilters = typeof raw.filters === 'string' ? parseFilterParam(raw.filters) : [];
  const mergedFilters = [...existingFilters, ...shorthandFilters];
  const filtersJson = mergedFilters.length > 0 ? JSON.stringify(mergedFilters) : undefined;

  const passThrough: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SHORTHAND_KEYS.has(key)) continue;
    if (key === 'page' || key === 'limit' || key === 'order' || key === 'includeDeleted' || key === 'filters') continue;
    if (value == null || value === '') continue;
    passThrough[key] = value;
  }

  return {
    ...passThrough,
    page,
    limit,
    sort,
    order,
    includeDeleted,
    ...(filtersJson ? { filters: filtersJson } : {}),
  };
}

function clampLimit(raw: unknown): number {
  if (raw == null || raw === '') return FILINGS_LIST_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return FILINGS_LIST_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), FILINGS_LIST_MAX_LIMIT);
}

function parseSort(rawSort: unknown, rawOrder: unknown): { sort?: string; order?: 'asc' | 'desc' } {
  if (typeof rawSort === 'string' && rawSort.includes(':')) {
    const [field, direction] = rawSort.split(':');
    const order: 'asc' | 'desc' = direction === 'asc' ? 'asc' : 'desc';
    return { sort: field, order };
  }
  const sort = stringOrUndefined(rawSort);
  const order: 'asc' | 'desc' | undefined =
    rawOrder === 'asc' ? 'asc' : rawOrder === 'desc' ? 'desc' : undefined;
  return { sort, order };
}

function stringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function parseCsv(v: unknown): string[] {
  if (typeof v !== 'string' || v.length === 0) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const __test__ = {
  FILINGS_LIST_DEFAULT_LIMIT,
  FILINGS_LIST_MAX_LIMIT,
  NOT_COMPLETED_STATES,
};
