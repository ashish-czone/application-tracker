import type { BaseListQuery } from '@packages/entity-engine';
import { parseFilterParam } from '@packages/query-builder';
import type { FilingBucket, FilingsListQuery } from './compliance-filings.dto';

/**
 * Domain-translation half of the list query pipeline. Pure URL parsing and
 * type coercion live in `FilingsListQuerySchema` (compliance-filings.dto.ts);
 * this file owns the bits that know what compliance-domain shorthand *means*:
 *
 *   - `bucket` semantics: overdue / due-today / upcoming / filed → compound
 *     date + status predicates
 *   - shorthand → engine filter shape: dueBefore/dueAfter/notCompleted/status
 *     into the `[{ field, operator, value }]` JSON the entity-engine consumes
 *
 * This split is deliberate. Zod handles validation; helpers handle domain
 * translation. The two-step controller pipeline reads cleanly:
 *
 *   const parsed   = FilingsListQuerySchema.parse(query);
 *   const baseQry  = buildBaseListQuery(parsed, today);
 *   return service.list(baseQry, accessCtx);
 *
 * The service signature stays in entity-engine BaseListQuery terms — it
 * doesn't need to know about compliance shorthand or buckets.
 */

const NOT_COMPLETED_STATES = ['pending', 'in_progress', 'review', 'rejected'];

interface StructuredFilter {
  field: string;
  operator: string;
  value: unknown;
}

function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Expand a `bucket` alias into the primitive shorthand the filter
 * builder already understands. Returns a copy of the parsed query with
 * `bucket` removed and the equivalent dueBefore/dueAfter/notCompleted/
 * status values populated. `today` is supplied by the controller from
 * `APP_TIMEZONE` so all date-math stays on the server.
 */
export function expandBucketAlias(parsed: FilingsListQuery, today: string): FilingsListQuery {
  if (!parsed.bucket) return parsed;

  const yesterday = addCalendarDays(today, -1);
  const tomorrow = addCalendarDays(today, 1);

  // Drop bucket from the spread so it doesn't propagate as a passthrough field.
  const { bucket, ...rest } = parsed;
  const expansion: FilingsListQuery = { ...rest };

  switch (bucket as FilingBucket) {
    case 'overdue':
      // dueDate < today, expressed via dueBefore (lte) on yesterday.
      expansion.notCompleted = true;
      expansion.dueBefore = yesterday;
      break;
    case 'due-today':
      expansion.notCompleted = true;
      expansion.dueBefore = today;
      expansion.dueAfter = today;
      break;
    case 'upcoming':
      // dueDate > today (everything future, dueThisWeek + later).
      expansion.notCompleted = true;
      expansion.dueAfter = tomorrow;
      break;
    case 'filed':
      expansion.status = ['completed'];
      break;
  }

  return expansion;
}

/**
 * Translate the parsed `FilingsListQuery` into the entity-engine's
 * `BaseListQuery` shape. Bucket expansion runs first (if `bucket` is set),
 * then the shorthand date/status fields are folded into a structured
 * filters JSON, merged with any caller-supplied `filters=...` param.
 *
 * `today` is required only when the parsed input might contain a `bucket`;
 * callers that know they're not using buckets can pass any string.
 */
export function buildBaseListQuery(parsed: FilingsListQuery, today: string): BaseListQuery {
  const expanded = expandBucketAlias(parsed, today);

  const shorthandFilters: StructuredFilter[] = [];

  if (expanded.dueBefore) {
    shorthandFilters.push({ field: 'dueDate', operator: 'lte', value: expanded.dueBefore });
  }

  if (expanded.dueAfter) {
    shorthandFilters.push({ field: 'dueDate', operator: 'gte', value: expanded.dueAfter });
  }

  if (expanded.notCompleted) {
    shorthandFilters.push({ field: 'status', operator: 'in', value: NOT_COMPLETED_STATES });
  }

  if (expanded.status && expanded.status.length > 0) {
    shorthandFilters.push({
      field: 'status',
      operator: expanded.status.length === 1 ? 'eq' : 'in',
      value: expanded.status.length === 1 ? expanded.status[0] : expanded.status,
    });
  }

  const existingFilters =
    typeof expanded.filters === 'string' ? parseFilterParam(expanded.filters) : [];
  const mergedFilters = [...existingFilters, ...shorthandFilters];
  const filtersJson = mergedFilters.length > 0 ? JSON.stringify(mergedFilters) : undefined;

  // Strip the keys we've already consumed; everything else (clientId, lawId,
  // ruleId, assigneeId, assigneeTeamId, search, today, etc.) flows through
  // as engine pass-through fields.
  const passThrough: Record<string, unknown> = {};
  const consumed = new Set([
    'page',
    'limit',
    'sort',
    'order',
    'includeDeleted',
    'bucket',
    'status',
    'dueBefore',
    'dueAfter',
    'notCompleted',
    'filters',
  ]);
  for (const [key, value] of Object.entries(expanded)) {
    if (consumed.has(key)) continue;
    if (value == null || value === '') continue;
    passThrough[key] = value;
  }

  return {
    ...passThrough,
    page: expanded.page,
    limit: expanded.limit,
    sort: expanded.sort,
    order: expanded.order,
    includeDeleted: expanded.includeDeleted,
    ...(filtersJson ? { filters: filtersJson } : {}),
  };
}
