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
  overdueClientCount: 0,
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

export type ClientFilingBucket = 'overdue' | 'due-today' | 'upcoming' | 'filed';

export interface UseClientFilingsOptions {
  page?: number;
  limit?: number;
  /**
   * Server-side bucket alias (overdue / due-today / upcoming / filed). When
   * supplied, the page no longer needs to filter rows in JS — the server
   * applies the corresponding date / status predicates and returns the
   * exact set + correct pagination meta.
   */
  bucket?: ClientFilingBucket;
}

/**
 * Paginated list of a single client's filings, sorted by due date desc. Wraps
 * the global filings list endpoint with a `clientId=eq` filter and an optional
 * `bucket` alias. Each row has `lawCode`, `lawName`, `lawJurisdiction` (via
 * LawsService composition) and `clientName`, `assigneeFirstName`,
 * `assigneeLastName`, `assigneeTeamName` (via SQL LEFT JOIN on shared-identity
 * tables) embedded server-side.
 */
export function useClientFilings(
  clientId: string | null | undefined,
  options: UseClientFilingsOptions = {},
) {
  const { apiFn } = useEntityEngine();
  const enabled = !!clientId;
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const bucket = options.bucket;

  const search = new URLSearchParams();
  search.set('page', String(page));
  search.set('limit', String(limit));
  search.set('sort', 'dueDate:desc');
  if (clientId) search.set('clientId', clientId);
  if (bucket) search.set('bucket', bucket);

  const query = useQuery<PaginatedResponse<FilingListRow>>({
    queryKey: ['compliance-filings', 'list', 'by-client', { clientId, page, limit, bucket }],
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

const CONTACTS_DISPLAY_LIMIT = 10;

/**
 * Contacts attached to a single compliance client. The detail page only
 * renders the primary + first secondary contact, so we cap at 10 (down from
 * the prior 50) — past that, this fetch is unused. The proper fix when a
 * client genuinely needs to surface every contact is a paginated contacts
 * panel; deferred until that screen exists.
 */
export function useClientContacts(clientId: string | null | undefined) {
  const { apiFn } = useEntityEngine();
  const enabled = !!clientId;
  const query = useQuery<PaginatedResponse<ClientContactRecord>>({
    queryKey: ['client-contacts', { clientId }],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ClientContactRecord>>(
        `/client-contacts?complianceClientId=${encodeURIComponent(clientId ?? '')}&limit=${CONTACTS_DISPLAY_LIMIT}`,
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
  registrationNumber?: string | null;
  effectiveFrom?: string | null;
  registeredAt?: string | null;
  deactivatedAt?: string | null;
  /**
   * Embedded server-side via LEFT JOIN on `compliance_laws` — see
   * `ClientRegistrationsService.list`. Pre-server-join the UI relied on
   * `lawId__label` (entity-engine lookup resolver), but registrations
   * never went through the engine; the labels were always undefined. The
   * service now joins explicitly so these fields are populated.
   */
  lawCode?: string | null;
  lawName?: string | null;
  lawJurisdiction?: string | null;
  lawIssuingAuthority?: string | null;
  [key: string]: unknown;
}

/**
 * Compact preview of a client's registrations for the Laws tab and overview
 * surfaces. Fetches the top-5 by `registeredAt:desc` and surfaces
 * `meta.total` so callers can render "view all N" without re-counting in JS.
 *
 * Pairs with {@link useClientRegistrationsList} for the full Registrations
 * tab — the list/preview split exists so the preview never silently
 * truncates (it asks for exactly 5 + a count) and the tab can paginate +
 * sort + search server-side.
 */
const REGISTRATIONS_PREVIEW_LIMIT = 5;

export function useClientRegistrationsSummary(clientId: string | null | undefined) {
  const { apiFn } = useEntityEngine();
  const enabled = !!clientId;
  const search = new URLSearchParams();
  if (clientId) search.set('clientId', clientId);
  search.set('limit', String(REGISTRATIONS_PREVIEW_LIMIT));
  search.set('sort', 'registeredAt:desc');

  const query = useQuery<PaginatedResponse<ClientRegistrationRecord>>({
    queryKey: ['client-registrations', 'summary', { clientId }],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ClientRegistrationRecord>>(
        `/client-registrations?${search.toString()}`,
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

export interface UseClientRegistrationsListOptions {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}

/**
 * Pure URL builder for the registrations list endpoint. Extracted from
 * `useClientRegistrationsList` so unit tests can assert query-param
 * shape without needing a TanStack Query harness or apiFn mock.
 */
function buildRegistrationsListQueryString(
  clientId: string | null | undefined,
  options: UseClientRegistrationsListOptions,
): string {
  const params = new URLSearchParams();
  params.set('page', String(options.page ?? 1));
  params.set('limit', String(options.limit ?? 25));
  params.set('sort', options.sort ?? 'registeredAt:desc');
  if (clientId) params.set('clientId', clientId);
  if (options.search) params.set('search', options.search);
  return params.toString();
}

/**
 * Server-paginated registrations for the Registrations tab on the client
 * detail page. URL params round-trip to the server: page, limit, search
 * (ilike on registrationNumber), sort (`<field>:<asc|desc>` —
 * `registeredAt`, `effectiveFrom`, `registrationNumber`, `deactivatedAt`
 * are allowlisted server-side; unknown fields fall back to
 * `registeredAt:desc`).
 *
 * Each row carries embedded `lawCode` / `lawName` / `lawJurisdiction` /
 * `lawIssuingAuthority` from the server-side LEFT JOIN, so the tab never
 * client-side-joins `/laws`.
 */
export function useClientRegistrationsList(
  clientId: string | null | undefined,
  options: UseClientRegistrationsListOptions = {},
) {
  const { apiFn } = useEntityEngine();
  const enabled = !!clientId;
  const page = options.page ?? 1;
  const limit = options.limit ?? 25;
  const sort = options.sort ?? 'registeredAt:desc';
  const qs = buildRegistrationsListQueryString(clientId, {
    page,
    limit,
    sort,
    search: options.search,
  });

  const query = useQuery<PaginatedResponse<ClientRegistrationRecord>>({
    queryKey: [
      'client-registrations',
      'list',
      'by-client',
      { clientId, page, limit, sort, search: options.search ?? '' },
    ],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ClientRegistrationRecord>>(`/client-registrations?${qs}`),
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

export const __test__ = {
  buildRegistrationsListQueryString,
};
