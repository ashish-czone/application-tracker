import { useQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';

export interface ReportRangeParams {
  from?: string;
  to?: string;
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
  return search.toString();
}

export function useComplianceTrend(range: ReportRangeParams = {}) {
  const { apiFn } = useEntityEngine();
  const qs = toQuery(range);
  const query = useQuery<TrendBucket[]>({
    queryKey: ['compliance-reports', 'trend', range],
    queryFn: () => apiFn.get<TrendBucket[]>(`/compliance-reports/trend${qs ? `?${qs}` : ''}`),
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
    queryKey: ['compliance-reports', 'by-client', range],
    queryFn: () => apiFn.get<ClientBreakdownRow[]>(`/compliance-reports/by-client${qs ? `?${qs}` : ''}`),
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
    queryKey: ['compliance-reports', 'aging'],
    queryFn: () => apiFn.get<AgingBucket[]>(`/compliance-reports/aging`),
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
    queryKey: ['compliance-reports', 'severity'],
    queryFn: () => apiFn.get<SeverityBreakdownRow[]>(`/compliance-reports/severity`),
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
    queryKey: ['compliance-reports', 'team-workload', range],
    queryFn: () =>
      apiFn.get<TeamWorkloadRow[]>(`/compliance-reports/team-workload${qs ? `?${qs}` : ''}`),
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
}
