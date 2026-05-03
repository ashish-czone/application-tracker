import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';
import type { FilingListRow } from './useFilingsByDueWindow';
import type { FilingsListBucket, FilingsListMeta } from './useFilingsList';
import { buildFilingsListQueryString } from './useFilingsList';

export interface UseFilingsBucketInfiniteParams {
  bucket: FilingsListBucket;
  /** Page size; defaults to 20. */
  limit?: number;
  search?: string;
  sort?: string;
  clientIds?: string[];
  lawIds?: string[];
  assigneeTeamIds?: string[];
  /** Test override of "today". */
  today?: string;
  /** Kanban only fires when its tab is active. */
  enabled?: boolean;
}

export interface UseFilingsBucketInfiniteResult {
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

/**
 * Infinite-query variant of `useFilingsList` for kanban columns. Each column
 * (overdue, due-today, due-this-week, upcoming, filed) gets its own hook
 * instance, so per-column "Load more" pulls page N+1 of THAT bucket only —
 * replacing the previous pattern where the page pulled `limit=1000` of the
 * whole filings table and grouped client-side (a data-fetching.md
 * violation).
 *
 * Filters (search, clientIds, lawIds, assigneeTeamIds) propagate through
 * `buildFilingsListQueryString` so per-column queries stay consistent with
 * the list view and the active filter chips.
 */
export function useFilingsBucketInfinite(
  params: UseFilingsBucketInfiniteParams,
): UseFilingsBucketInfiniteResult {
  const { apiFn } = useEntityEngine();
  const limit = params.limit ?? 20;
  const enabled = params.enabled ?? true;

  const query = useInfiniteQuery<PaginatedResponse<FilingListRow>>({
    queryKey: [
      'compliance-filings',
      'bucket',
      params.bucket,
      {
        limit,
        search: params.search ?? null,
        sort: params.sort ?? 'dueDate:asc',
        clientIds: params.clientIds ?? null,
        lawIds: params.lawIds ?? null,
        assigneeTeamIds: params.assigneeTeamIds ?? null,
        today: params.today ?? null,
      },
    ],
    queryFn: ({ pageParam = 1 }) => {
      const qs = buildFilingsListQueryString({
        bucket: params.bucket,
        page: pageParam as number,
        limit,
        sort: params.sort ?? 'dueDate:asc',
        search: params.search,
        clientIds: params.clientIds,
        lawIds: params.lawIds,
        assigneeTeamIds: params.assigneeTeamIds,
        today: params.today,
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
