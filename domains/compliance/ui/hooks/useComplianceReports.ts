import { useQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';

export interface ReportRangeParams {
  from?: string;
  to?: string;
  /** Optional server-side substring filter — applied per-endpoint (clientName for by-client, team name for team-workload). */
  q?: string;
}

export interface TrendBucket {
  month: string;
  onTime: number;
  late: number;
  overdue: number;
}

export interface ClientBreakdownRow {
  clientId: string;
  clientName: string;
  totalFilings: number;
  onTime: number;
  late: number;
  overdue: number;
  onTimeRate: number;
}

export interface AgingBucket {
  range: '1-7' | '8-15' | '16-30' | '30+';
  count: number;
}

export interface SeverityBreakdownRow {
  priority: string;
  count: number;
}

export interface TeamWorkloadRow {
  assigneeTeamId: string;
  assigneeTeamName: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  onTimeRate: number;
}

function toQuery(params: ReportRangeParams): string {
  const search = new URLSearchParams();
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.q) search.set('q', params.q);
  return search.toString();
}

export function useComplianceTrend(range: ReportRangeParams = {}) {
  const { apiFn } = useEntityEngine();
  const qs = toQuery(range);
  const query = useQuery<TrendBucket[]>({
    queryKey: ['compliance-filings', 'reports', 'trend', range],
    queryFn: () => apiFn.get<TrendBucket[]>(`/compliance-filings/reports/trend${qs ? `?${qs}` : ''}`),
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
}

export function useComplianceByClient(range: ReportRangeParams = {}) {
  const { apiFn } = useEntityEngine();
  const qs = toQuery(range);
  const query = useQuery<ClientBreakdownRow[]>({
    queryKey: ['compliance-filings', 'reports', 'by-client', range],
    queryFn: () => apiFn.get<ClientBreakdownRow[]>(`/compliance-filings/reports/by-client${qs ? `?${qs}` : ''}`),
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
}

export function useOverdueAging() {
  const { apiFn } = useEntityEngine();
  const query = useQuery<AgingBucket[]>({
    queryKey: ['compliance-filings', 'reports', 'aging'],
    queryFn: () => apiFn.get<AgingBucket[]>(`/compliance-filings/reports/aging`),
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
}

export function useOverdueSeverity() {
  const { apiFn } = useEntityEngine();
  const query = useQuery<SeverityBreakdownRow[]>({
    queryKey: ['compliance-filings', 'reports', 'severity'],
    queryFn: () => apiFn.get<SeverityBreakdownRow[]>(`/compliance-filings/reports/severity`),
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
}

export function useTeamWorkload(range: ReportRangeParams = {}) {
  const { apiFn } = useEntityEngine();
  const qs = toQuery(range);
  const query = useQuery<TeamWorkloadRow[]>({
    queryKey: ['org-units', 'reports', 'team-workload', range],
    queryFn: () =>
      apiFn.get<TeamWorkloadRow[]>(`/org-units/reports/team-workload${qs ? `?${qs}` : ''}`),
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
}
