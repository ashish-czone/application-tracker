import { useQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';

/**
 * Row shape for filings rendered in dashboard widgets and the filings list.
 * The compliance-filings list endpoint embeds display fields per row via
 * SQL LEFT JOINs (clients, users, org_units) and a service-composition
 * call into LawsService:
 *  - `clientName` from clients
 *  - `assigneeFirstName` / `assigneeLastName` from users
 *  - `assigneeTeamName` from org_units
 *  - `lawCode` / `lawName` / `lawJurisdiction` via ComplianceFilingsService
 * Rule name is not currently embedded — fall back to the filing's own
 * `title` when a rule label is needed.
 */
export interface FilingListRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  assigneeTeamId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  ruleId: string;
  clientId: string;
  lawId: string;
  periodStart: string;
  periodEnd: string;
  externalKey: string | null;
  createdAt: string;
  updatedAt: string;
  // Server-embedded display fields (LEFT-JOINed; null when joinee missing or soft-deleted):
  clientName?: string | null;
  assigneeFirstName?: string | null;
  assigneeLastName?: string | null;
  assigneeTeamName?: string | null;
  // Server-composed law display fields (via LawsService.findDisplayByIds):
  lawCode?: string;
  lawName?: string;
  lawJurisdiction?: string | null;
}

export interface FilingsByDueWindowMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilingsByDueWindowResult {
  rows: FilingListRow[];
  total: number;
  loading: boolean;
  error: unknown;
  meta?: FilingsByDueWindowMeta;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: FilingsByDueWindowMeta;
}

interface FilingsQueryParams {
  dueBefore?: string;
  dueAfter?: string;
  notCompleted?: boolean;
  sort?: string;
  limit?: number;
}

function buildQueryString(params: FilingsQueryParams): string {
  const search = new URLSearchParams();
  if (params.dueBefore) search.set('dueBefore', params.dueBefore);
  if (params.dueAfter) search.set('dueAfter', params.dueAfter);
  if (params.notCompleted) search.set('notCompleted', 'true');
  if (params.sort) search.set('sort', params.sort);
  if (params.limit != null) search.set('limit', String(params.limit));
  return search.toString();
}

/**
 * Format a Date as a local-timezone YYYY-MM-DD calendar string. Used to render
 * "today" / "today + N" boundaries for the dashboard widgets. The server
 * interprets the boundary in APP_TIMEZONE; for v1 the user's local clock and
 * APP_TIMEZONE are assumed close enough for widget purposes.
 */
function toCalendarDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayCalendarDate(): string {
  return toCalendarDate(new Date());
}

function plusDaysCalendarDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toCalendarDate(d);
}

/**
 * Generic dashboard-widget hook. Hits the filtered filings endpoint with a
 * narrow due-date window and returns the small page of rows + total count.
 * Replaces the limit=1000 + client-side filter pattern that violated
 * `.claude/rules/data-fetching.md`.
 */
function useFilingsByDueWindow(
  key: string,
  params: FilingsQueryParams,
): FilingsByDueWindowResult {
  const { apiFn } = useEntityEngine();
  const qs = buildQueryString(params);

  const query = useQuery<PaginatedResponse<FilingListRow>>({
    queryKey: ['compliance-filings', key, params],
    queryFn: () => apiFn.get<PaginatedResponse<FilingListRow>>(`/compliance-filings?${qs}`),
  });

  return {
    rows: query.data?.data ?? [],
    total: query.data?.meta.total ?? 0,
    meta: query.data?.meta,
    loading: query.isLoading,
    error: query.error,
  };
}

export interface UseOverdueFilingsOptions {
  /** Maximum rows to render. Defaults to 5. Hard-capped by the server at 100. */
  limit?: number;
}

/**
 * Filings that are not completed and have a `dueDate` strictly before today.
 * Sorted by `dueDate` ascending so the longest-overdue items surface first.
 */
export function useOverdueFilings(options: UseOverdueFilingsOptions = {}): FilingsByDueWindowResult {
  const limit = options.limit ?? 5;
  return useFilingsByDueWindow('overdue', {
    notCompleted: true,
    dueBefore: todayCalendarDate(),
    sort: 'dueDate:asc',
    limit,
  });
}

export interface UseUpcomingFilingsOptions {
  /** Window length in days from today (inclusive). Defaults to 7. */
  withinDays?: number;
  /** Maximum rows to render. Defaults to 8. Hard-capped by the server at 100. */
  limit?: number;
}

/**
 * Filings that are not completed and fall in the [today, today + withinDays]
 * window. Sorted ascending by due date so the soonest item is first. Note the
 * window boundary uses the user's local calendar — see `toCalendarDate`.
 */
export function useUpcomingFilings(options: UseUpcomingFilingsOptions = {}): FilingsByDueWindowResult {
  const withinDays = options.withinDays ?? 7;
  const limit = options.limit ?? 8;
  return useFilingsByDueWindow('upcoming', {
    notCompleted: true,
    dueAfter: todayCalendarDate(),
    dueBefore: plusDaysCalendarDate(withinDays),
    sort: 'dueDate:asc',
    limit,
  });
}

export const __test__ = {
  toCalendarDate,
  buildQueryString,
};
