import { useQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';
import type { FilingsSummary } from './useFilingsSummary';
import type { FilingListRow } from './useFilingsByDueWindow';
import type { ClientContactRecord } from './useClientsApi';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const ZERO_SUMMARY: FilingsSummary = {
  total: 0,
  overdue: 0,
  dueToday: 0,
  dueThisWeek: 0,
  upcoming: 0,
  completed: 0,
  cancelled: 0,
};

/**
 * Per-client filings KPI summary. Hits the shared
 * /compliance-filings/summary endpoint with a clientId scope; counts come
 * from the server, RBAC-filtered.
 */
export function useClientFilingsSummary(clientId: string | null | undefined) {
  const { apiFn } = useEntityEngine();
  const enabled = !!clientId;
  const query = useQuery<FilingsSummary>({
    queryKey: ['compliance-filings', 'summary', { clientId }],
    queryFn: () =>
      apiFn.get<FilingsSummary>(
        `/compliance-filings/summary?clientId=${encodeURIComponent(clientId ?? '')}`,
      ),
    enabled,
  });
  return {
    summary: query.data ?? ZERO_SUMMARY,
    loading: query.isLoading,
    error: query.error,
  };
}

export interface UseClientFilingsOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated list of a single client's filings, sorted by due date desc. Wraps
 * the global filings list endpoint with a `clientId=eq` filter. Each row has
 * `lawCode`, `lawName`, `lawJurisdiction`, `clientId__label` embedded via the
 * server-side composition done in PR-1.
 */
export function useClientFilings(
  clientId: string | null | undefined,
  options: UseClientFilingsOptions = {},
) {
  const { apiFn } = useEntityEngine();
  const enabled = !!clientId;
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;

  const search = new URLSearchParams();
  search.set('page', String(page));
  search.set('limit', String(limit));
  search.set('sort', 'dueDate:desc');
  if (clientId) search.set('clientId', clientId);

  const query = useQuery<PaginatedResponse<FilingListRow>>({
    queryKey: ['compliance-filings', 'list', 'by-client', { clientId, page, limit }],
    queryFn: () =>
      apiFn.get<PaginatedResponse<FilingListRow>>(`/compliance-filings?${search.toString()}`),
    enabled,
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

/**
 * Contacts attached to a single compliance client. The client-contacts
 * endpoint accepts the legacy equality filter on `complianceClientId` via
 * the entity engine's parseLegacyFilters.
 */
export function useClientContacts(clientId: string | null | undefined) {
  const { apiFn } = useEntityEngine();
  const enabled = !!clientId;
  const query = useQuery<PaginatedResponse<ClientContactRecord>>({
    queryKey: ['client-contacts', { clientId }],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ClientContactRecord>>(
        `/client-contacts?complianceClientId=${encodeURIComponent(clientId ?? '')}&limit=50`,
      ),
    enabled,
  });
  return {
    contacts: query.data?.data ?? [],
    total: query.data?.meta.total ?? 0,
    loading: query.isLoading,
    error: query.error,
  };
}

export interface ClientRegistrationRecord {
  id: string;
  clientId: string;
  lawId: string;
  status?: string | null;
  registeredAt?: string | null;
  primaryHandlerUserId?: string | null;
  primaryHandlerTeamId?: string | null;
  cadence?: string | null;
  /** Embedded by the engine's lookup-label resolver. */
  lawId__label?: string | null;
  primaryHandlerUserId__label?: string | null;
  primaryHandlerTeamId__label?: string | null;
  [key: string]: unknown;
}

/**
 * Active registrations for a single client. Filters server-side via the
 * client-registrations endpoint with a `clientId=eq` legacy filter.
 */
export function useClientRegistrations(clientId: string | null | undefined) {
  const { apiFn } = useEntityEngine();
  const enabled = !!clientId;
  const query = useQuery<PaginatedResponse<ClientRegistrationRecord>>({
    queryKey: ['client-registrations', { clientId }],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ClientRegistrationRecord>>(
        `/client-registrations?clientId=${encodeURIComponent(clientId ?? '')}&limit=100`,
      ),
    enabled,
  });
  return {
    registrations: query.data?.data ?? [],
    total: query.data?.meta.total ?? 0,
    loading: query.isLoading,
    error: query.error,
  };
}
