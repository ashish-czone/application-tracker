import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';
import type { FilingListRow } from './useFilingsByDueWindow';
import type { FilingsListMeta } from './useFilingsList';

export interface UseFilingsRangeInfiniteParams {
  /** Inclusive lower bound (YYYY-MM-DD). */
  dueAfter: string;
  /** Inclusive upper bound (YYYY-MM-DD). */
  dueBefore: string;
  /**
   * Page size. Defaults to 25 to align with the rest of the compliance
   * infinite-query hooks (`useFilingsBucketInfinite` = 20, `useUsersApi`
   * = 25). The calendar surfaces a "Showing N of M filings" footer and
   * a "Load more" button via `ComplianceCalendar`'s `meta`/`onLoadMore`
   * props, so any window with > limit filings is visible to the user
   * rather than silently truncated.
   */
  limit?: number;
  search?: string;
  sort?: string;
  clientIds?: string[];
  lawIds?: string[];
  assigneeTeamIds?: string[];
  enabled?: boolean;
}

export interface UseFilingsRangeInfiniteResult {
  rows: FilingListRow[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  error: unknown;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: FilingsListMeta;
}

function buildRangeQueryString(params: {
  dueAfter: string;
  dueBefore: string;
  page: number;
  limit: number;
  sort?: string;
  search?: string;
  clientIds?: string[];
  lawIds?: string[];
  assigneeTeamIds?: string[];
}): string {
  const search = new URLSearchParams();
  search.set('dueAfter', params.dueAfter);
  search.set('dueBefore', params.dueBefore);
  search.set('page', String(params.page));
  search.set('limit', String(params.limit));
  if (params.sort) search.set('sort', params.sort);
  if (params.search) search.set('search', params.search);

  const inFilters: Array<Record<string, unknown>> = [];
  if (params.clientIds && params.clientIds.length > 0) {
    inFilters.push({ field: 'clientId', operator: 'in', value: params.clientIds });
  }
  if (params.lawIds && params.lawIds.length > 0) {
    inFilters.push({ field: 'lawId', operator: 'in', value: params.lawIds });
  }
  if (params.assigneeTeamIds && params.assigneeTeamIds.length > 0) {
    inFilters.push({ field: 'assigneeTeamId', operator: 'in', value: params.assigneeTeamIds });
  }
  if (inFilters.length > 0) {
    search.set('filters', JSON.stringify(inFilters));
  }
  return search.toString();
}

/**
 * Infinite-query hook for the calendar view. Asks `/compliance-filings?
 * dueAfter=…&dueBefore=…&page=N` for the visible window (calculated from
 * the calendar's anchor + view in the parent), appending pages on the
 * "Load more" footer click. Page-level filters (search, client/law/team)
 * propagate identically to list and kanban so the three views stay
 * consistent.
 */
export function useFilingsRangeInfinite(
  params: UseFilingsRangeInfiniteParams,
): UseFilingsRangeInfiniteResult {
  const { apiFn } = useEntityEngine();
  const limit = params.limit ?? 25;
  const enabled = params.enabled ?? true;

  const query = useInfiniteQuery<PaginatedResponse<FilingListRow>>({
    queryKey: [
      'compliance-filings',
      'range',
      {
        dueAfter: params.dueAfter,
        dueBefore: params.dueBefore,
        limit,
        search: params.search ?? null,
        sort: params.sort ?? 'dueDate:asc',
        clientIds: params.clientIds ?? null,
        lawIds: params.lawIds ?? null,
        assigneeTeamIds: params.assigneeTeamIds ?? null,
      },
    ],
    queryFn: ({ pageParam = 1 }) => {
      const qs = buildRangeQueryString({
        dueAfter: params.dueAfter,
        dueBefore: params.dueBefore,
        page: pageParam as number,
        limit,
        sort: params.sort ?? 'dueDate:asc',
        search: params.search,
        clientIds: params.clientIds,
        lawIds: params.lawIds,
        assigneeTeamIds: params.assigneeTeamIds,
      });
      return apiFn.get<PaginatedResponse<FilingListRow>>(`/compliance-filings?${qs}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const next = lastPage.meta.page + 1;
      return next <= lastPage.meta.totalPages ? next : undefined;
    },
    enabled,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.data),
    [query.data],
  );
  const total = query.data?.pages[0]?.meta.total ?? 0;

  return {
    rows,
    total,
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
    error: query.error,
  };
}

export const __test__ = { buildRangeQueryString };
