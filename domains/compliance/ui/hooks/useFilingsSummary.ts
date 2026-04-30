import { useQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';

export interface FilingsSummary {
  total: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  overdueClientCount: number;
}

export interface UseFilingsSummaryResult {
  summary: FilingsSummary;
  loading: boolean;
  error: unknown;
}

const ZERO_SUMMARY: FilingsSummary = {
  total: 0,
  overdue: 0,
  dueToday: 0,
  dueThisWeek: 0,
  upcoming: 0,
  completed: 0,
  cancelled: 0,
  overdueClientCount: 0,
};

/**
 * One wire call to the compliance-filings summary aggregation endpoint. Used
 * by the FilingsPage KPI cards. Counts are computed server-side with the
 * caller's RBAC scope applied — no client-side derivation, no full-table
 * fetch.
 */
export function useFilingsSummary(): UseFilingsSummaryResult {
  const { apiFn } = useEntityEngine();
  const query = useQuery<FilingsSummary>({
    queryKey: ['compliance-filings', 'summary'],
    queryFn: () => apiFn.get<FilingsSummary>('/compliance-filings/summary'),
  });
  return {
    summary: query.data ?? ZERO_SUMMARY,
    loading: query.isLoading,
    error: query.error,
  };
}
