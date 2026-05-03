import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type ClientRiskLevel = 'healthy' | 'at-risk' | 'critical';
export type ClientStatusKey = 'active' | 'onboarding' | 'dormant';

export interface ClientRecord {
  id: string;
  name: string;
  legalName: string | null;
  email?: string | null;
  phone?: string | null;
  websiteDomain?: string | null;
  taxId?: string | null;
  industry?: string | null;
  complianceAccountManagerId?: string | null;
  complianceAccountManagerId__label?: string | null;
  complianceStatus?: string | null;
  complianceOnboardedAt?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  addressCountryId?: string | null;
  complianceNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  registeredLaws?: number;
  openFilings?: number;
  overdueFilings?: number;
  dueThisWeek?: number;
  completedFilings?: number;
  onTimeFilings?: number;
  onTimePct?: number;
  lastFilingDate?: string | null;
  risk?: ClientRiskLevel;
  [key: string]: unknown;
}

export interface ClientsSummary {
  total: number;
  byStatus: { active: number; onboarding: number; dormant: number };
  byRisk: { healthy: number; 'at-risk': number; critical: number };
  totalOverdue: number;
  clientsWithOverdue: number;
  totalRegistrations: number;
  avgOnTimePct: number;
}

export interface HandlerOption {
  id: string;
  name: string;
}

export interface ClientsListParams {
  page?: number;
  limit?: number;
  sort?: string;
  status?: ClientStatusKey;
  /** Comma-separated risk levels (e.g. `"critical,at-risk"`). */
  risk?: string;
  /** Comma-separated handler ids. */
  handlerId?: string;
  q?: string;
}

export interface ClientContactRecord {
  id: string;
  complianceClientId: string | null;
  fullName: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  complianceDesignation?: string | null;
  complianceIsPrimary: boolean;
  complianceNotes?: string | null;
  [key: string]: unknown;
}

export interface CreateClientWithContactsPayload {
  client: {
    name: string;
    legalName: string;
    email?: string;
    phone?: string;
    websiteDomain?: string;
    taxId?: string;
    industry?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    addressCountryId?: string;
    complianceAccountManagerId?: string;
    complianceStatus?: string;
    complianceOnboardedAt?: string;
    complianceNotes?: string;
  };
  contacts: Array<{
    fullName: string;
    primaryEmail?: string;
    primaryPhone?: string;
    complianceDesignation?: string;
    complianceIsPrimary?: boolean;
    complianceNotes?: string;
  }>;
}

export interface CreateClientWithContactsResult {
  client: ClientRecord;
  contacts: ClientContactRecord[];
}

export interface ClientRegistrationRecord {
  id: string;
  clientId: string;
  lawId: string;
  registeredAt: string;
  deactivatedAt: string | null;
}

export interface CreateClientRegistrationsPayload {
  clientId: string;
  lawCodes: string[];
}

export interface RegistrationDeactivationPreview {
  registrationId: string;
  deactivatedAt: string;
  cancelledAfter: number;
  remainingBefore: number;
}

export interface DeactivateRegistrationPayload {
  clientId: string;
  lawId: string;
  deactivatedAt: string;
  alsoCancelEarlier?: boolean;
  comment?: string;
}

export interface DeactivateRegistrationResult {
  registrationId: string;
  deactivatedAt: string;
  autoCancelledFilingIds: string[];
  manuallyCancelledFilingIds: string[];
}

type ApiFn = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
};

const BASE = '/clients';

export const clientsQueryKey = ['clients'] as const;

/**
 * `queryOptions` factory for clients reads. Pages call
 * `useQuery(clientsQueries(apiFn).list(params))` directly rather than going
 * through the entity-engine FE registry. queryKey + URL stay colocated so
 * cross-page lists can't drift to incompatible cache keys.
 */
export function clientsQueries(apiFn: ApiFn) {
  return {
    list: (params: ClientsListParams = {}) =>
      queryOptions({
        queryKey: [...clientsQueryKey, 'list', params] as const,
        queryFn: () =>
          apiFn.get<PaginatedResponse<ClientRecord>>(
            `${BASE}${buildQuery(params as Record<string, unknown>)}`,
          ),
      }),
    detail: (id: string | null | undefined) =>
      queryOptions({
        queryKey: [...clientsQueryKey, 'detail', id] as const,
        queryFn: () => apiFn.get<ClientRecord>(`${BASE}/${id}`),
        enabled: !!id,
      }),
  };
}

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '' && v !== false) sp.set(k, String(v));
  }
  if (sp.get('page') === '1') sp.delete('page');
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Page-level KPI summary for the clients list view. */
export function useClientsSummary() {
  const { apiFn } = useEntityEngine();
  return useQuery({
    queryKey: [...clientsQueryKey, 'summary'],
    queryFn: () => apiFn.get<ClientsSummary>(`${BASE}/summary`),
  });
}

/** Distinct account-manager users for the handler filter dropdown. */
export function useClientHandlerOptions() {
  const { apiFn } = useEntityEngine();
  return useQuery({
    queryKey: [...clientsQueryKey, 'handler-options'],
    queryFn: () => apiFn.get<HandlerOption[]>(`${BASE}/handler-options`),
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Typeahead options — backs `<ClientPicker />` and any client filter dropdown.
// Replaces the previous `limit=1000` page-fetch pattern (a data-fetching.md
// violation) with a server-side ILIKE on name + legalName.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientOption {
  id: string;
  name: string;
}

export interface ClientOptionsParams {
  /** Substring query (server ILIKEs name + legalName, case-insensitive). */
  search?: string;
  /**
   * Hydrate labels for already-selected chips. When present, server bypasses
   * `search` and returns only rows whose id is in this set, so a reopened
   * page can show its filter chips with names regardless of search state.
   */
  ids?: readonly string[];
  /** Defaults to 25 server-side; clamped to 50 max. */
  limit?: number;
}

function normaliseIds(ids: readonly string[] | undefined): string[] | undefined {
  if (!ids || ids.length === 0) return undefined;
  return [...new Set(ids)].sort();
}

function buildOptionsQuery(params: ClientOptionsParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set('search', params.search);
  const ids = normaliseIds(params.ids);
  if (ids) sp.set('ids', ids.join(','));
  if (params.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/**
 * `<ClientPicker>` and friends use this for the typeahead dropdown.
 * `placeholderData: keepPrevious` keeps the previous results visible while a
 * new search query is in-flight so the dropdown doesn't collapse on every
 * keystroke.
 */
export function useClientOptions(params: ClientOptionsParams = {}) {
  const { apiFn } = useEntityEngine();
  const ids = normaliseIds(params.ids);
  return useQuery({
    queryKey: [...clientsQueryKey, 'options', { search: params.search ?? '', ids: ids ?? null, limit: params.limit ?? null }] as const,
    queryFn: () => apiFn.get<ClientOption[]>(`${BASE}/options${buildOptionsQuery(params)}`),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export const __test__ = { buildOptionsQuery, normaliseIds };

export function useCreateClientWithContacts(options?: {
  onSuccess?: (result: CreateClientWithContactsResult) => void;
}) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateClientWithContactsPayload) =>
      apiFn.post<CreateClientWithContactsResult>(`${BASE}/with-contacts`, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: clientsQueryKey });
      toast.success('Client created');
      options?.onSuccess?.(result);
    },
    onError: (error: unknown) => {
      const message =
        (error as { body?: { message?: string } })?.body?.message ?? 'Failed to create client';
      toast.error(message);
    },
  });
}

/**
 * I20 error code raised by the backend when no team can be resolved as the
 * assignee for a (law, client) tuple. Drawers consuming this hook can branch
 * on it to render the inline "Configure handler" prompt (I23) instead of a
 * generic toast.
 */
export const NO_RESOLVABLE_ASSIGNEE = 'NO_RESOLVABLE_ASSIGNEE';

export interface NoResolvableAssigneeBody {
  code: typeof NO_RESOLVABLE_ASSIGNEE;
  message: string;
  lawId: string;
}

export function isNoResolvableAssigneeError(
  error: unknown,
): error is { body: NoResolvableAssigneeBody } {
  const body = (error as { body?: { code?: string } })?.body;
  return body?.code === NO_RESOLVABLE_ASSIGNEE;
}

export function useCreateClientRegistrations(options?: {
  onSuccess?: (result: ClientRegistrationRecord[]) => void;
}) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, lawCodes }: CreateClientRegistrationsPayload) =>
      apiFn.post<ClientRegistrationRecord[]>(`${BASE}/${clientId}/registrations`, { lawCodes }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['client-registrations'] });
      options?.onSuccess?.(result);
    },
    onError: (error: unknown) => {
      // I23: the NO_RESOLVABLE_ASSIGNEE rejection is rendered inline by the
      // consumer (NewClientDrawer) so the admin can act on it without losing
      // form state. Don't double-surface as a toast.
      if (isNoResolvableAssigneeError(error)) return;
      const message =
        (error as { body?: { message?: string } })?.body?.message ??
        'Failed to save law registrations';
      toast.error(message);
    },
  });
}

/**
 * Fetches the "what would happen if I deactivated this registration as of
 * `date`?" preview so the dialog can render "M filings will auto-cancel;
 * N filings remain open for earlier periods" live as the admin changes the
 * date. Params-null → disabled (used while the dialog is closed or the
 * date input is empty).
 */
export function useRegistrationDeactivationPreview(
  params: { clientId: string; lawId: string; date: string } | null,
) {
  const { apiFn } = useEntityEngine();
  return useQuery({
    queryKey: ['registration-deactivation-preview', params?.clientId, params?.lawId, params?.date],
    queryFn: () =>
      apiFn.get<RegistrationDeactivationPreview>(
        `${BASE}/${params!.clientId}/registrations/${params!.lawId}/deactivation-preview?date=${encodeURIComponent(params!.date)}`,
      ),
    enabled: !!params,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useDeactivateRegistration(options?: {
  onSuccess?: (result: DeactivateRegistrationResult) => void;
}) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, lawId, ...body }: DeactivateRegistrationPayload) =>
      apiFn.post<DeactivateRegistrationResult>(
        `${BASE}/${clientId}/registrations/${lawId}/deactivate`,
        body,
      ),
    onSuccess: (result) => {
      // Every surface that may have shown this registration or its filings
      // needs to refetch — registrations list, filings list, and any audit
      // timeline rendered on the client detail page.
      queryClient.invalidateQueries({ queryKey: ['client-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-filings'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      toast.success('Registration deactivated');
      options?.onSuccess?.(result);
    },
    onError: (error: unknown) => {
      const message =
        (error as { body?: { message?: string } })?.body?.message ??
        'Failed to deactivate registration';
      toast.error(message);
    },
  });
}

export function useSetPrimaryContact(options?: { onSuccess?: () => void }) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, contactId }: { clientId: string; contactId: string }) =>
      apiFn.put<void>(`${BASE}/${clientId}/contacts/${contactId}/primary`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts'] });
      toast.success('Primary contact updated');
      options?.onSuccess?.();
    },
    onError: (error: unknown) => {
      const message =
        (error as { body?: { message?: string } })?.body?.message ??
        'Failed to update primary contact';
      toast.error(message);
    },
  });
}
