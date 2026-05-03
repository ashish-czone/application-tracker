import { useQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';
import type { FilingListRow } from './useFilingsByDueWindow';

export interface FilingsListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type FilingsListBucket = 'overdue' | 'due-today' | 'due-this-week' | 'upcoming' | 'filed' | 'cancelled';

export interface UseFilingsListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  bucket?: FilingsListBucket;
  clientIds?: string[];
  lawIds?: string[];
  assigneeTeamIds?: string[];
  /** Optional override of "today" — only the FilingsPage tests pass this. */
  today?: string;
}

export interface UseFilingsListResult {
  rows: FilingListRow[];
  meta?: FilingsListMeta;
  total: number;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: FilingsListMeta;
}

function todayCalendar(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function plusDaysCalendar(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Translate a list-page filter chip ("Overdue", "Due today", …) into the
 * server's filter primitive vocabulary. Each bucket renders to a stable set
 * of `dueBefore` / `dueAfter` / `notCompleted` / `status` query params — the
 * server is the source of truth for "what is overdue."
 */
export function bucketToQueryParams(
  bucket: FilingsListBucket | undefined,
  today: string,
): Record<string, string> {
  switch (bucket) {
    case 'overdue':
      return { notCompleted: 'true', dueBefore: prevDay(today) };
    case 'due-today':
      return { notCompleted: 'true', dueAfter: prevDay(today), dueBefore: today };
    case 'due-this-week':
      return { notCompleted: 'true', dueAfter: today, dueBefore: addDays(today, 7) };
    case 'upcoming':
      return { notCompleted: 'true', dueAfter: addDays(today, 7) };
    case 'filed':
      return { status: 'completed' };
    case 'cancelled':
      return { status: 'cancelled' };
    case undefined:
      return {};
    default:
      return {};
  }
}

function prevDay(calendarDate: string): string {
  return addDays(calendarDate, -1);
}

function addDays(calendarDate: string, days: number): string {
  const [y, m, d] = calendarDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildFilingsListQueryString(params: UseFilingsListParams): string {
  const today = params.today ?? todayCalendar();
  const search = new URLSearchParams();

  if (params.page != null) search.set('page', String(params.page));
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.search) search.set('search', params.search);
  if (params.sort) search.set('sort', params.sort);

  const bucketParams = bucketToQueryParams(params.bucket, today);
  for (const [key, value] of Object.entries(bucketParams)) {
    search.set(key, value);
  }

  if (params.clientIds && params.clientIds.length > 0) {
    const filters = JSON.parse(search.get('filters') ?? '[]') as Array<Record<string, unknown>>;
    filters.push({ field: 'clientId', operator: 'in', value: params.clientIds });
    search.set('filters', JSON.stringify(filters));
  }
  if (params.lawIds && params.lawIds.length > 0) {
    const filters = JSON.parse(search.get('filters') ?? '[]') as Array<Record<string, unknown>>;
    filters.push({ field: 'lawId', operator: 'in', value: params.lawIds });
    search.set('filters', JSON.stringify(filters));
  }
  if (params.assigneeTeamIds && params.assigneeTeamIds.length > 0) {
    const filters = JSON.parse(search.get('filters') ?? '[]') as Array<Record<string, unknown>>;
    filters.push({ field: 'assigneeTeamId', operator: 'in', value: params.assigneeTeamIds });
    search.set('filters', JSON.stringify(filters));
  }

  return search.toString();
}

/**
 * Server-paginated filings list. Replaces the limit=1000 + client-side filter
 * pattern in `useComplianceFilingRows` for the list view. Bucket chips,
 * client/law/team filters, search, sort, and pagination round-trip to the
 * server. The list response embeds `clientName`, `assigneeFirstName`,
 * `assigneeLastName`, `assigneeTeamName` (SQL LEFT JOIN on shared-identity
 * tables) plus `lawCode/lawName/lawJurisdiction` (LawsService composition),
 * so no cross-list client-side join is needed.
 */
export function useFilingsList(params: UseFilingsListParams): UseFilingsListResult {
  const { apiFn } = useEntityEngine();
  const qs = buildFilingsListQueryString(params);

  const query = useQuery<PaginatedResponse<FilingListRow>>({
    queryKey: ['compliance-filings', 'list', params],
    queryFn: () => apiFn.get<PaginatedResponse<FilingListRow>>(`/compliance-filings?${qs}`),
    placeholderData: (prev) => prev,
  });

  return {
    rows: query.data?.data ?? [],
    meta: query.data?.meta,
    total: query.data?.meta.total ?? 0,
    loading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
  };
}

export const __test__ = {
  buildFilingsListQueryString,
  bucketToQueryParams,
  addDays,
  prevDay,
};
