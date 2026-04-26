import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useEntityEngine, useEntityHooks } from '@packages/entity-engine-ui';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ClientRecord {
  id: string;
  name: string;
  legalName: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  industryId?: string | null;
  accountManagerId?: string | null;
  status?: string | null;
  onboardedAt?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ClientContactRecord {
  id: string;
  clientId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  [key: string]: unknown;
}

export interface CreateClientWithContactsPayload {
  client: {
    name: string;
    legalName: string;
    email?: string;
    phone?: string;
    website?: string;
    taxId?: string;
    industryId?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryId?: string;
    accountManagerId?: string;
    status?: string;
    onboardedAt?: string;
    notes?: string;
  };
  contacts: Array<{
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
    isPrimary?: boolean;
    notes?: string;
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

export function useClientsList(params: Record<string, unknown> = {}) {
  const hooks = useEntityHooks('clients');
  return hooks.useList(params) as ReturnType<typeof hooks.useList> & {
    data?: PaginatedResponse<ClientRecord>;
  };
}

export function useClientDetail(id: string | null | undefined) {
  const hooks = useEntityHooks('clients');
  return hooks.useDetail(id) as ReturnType<typeof hooks.useDetail> & {
    data?: ClientRecord;
  };
}

export function useCreateClientWithContacts(options?: {
  onSuccess?: (result: CreateClientWithContactsResult) => void;
}) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateClientWithContactsPayload) =>
      apiFn.post<CreateClientWithContactsResult>('/clients/with-contacts', payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
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
      apiFn.post<ClientRegistrationRecord[]>(`/clients/${clientId}/registrations`, { lawCodes }),
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
        `/clients/${params!.clientId}/registrations/${params!.lawId}/deactivation-preview?date=${encodeURIComponent(params!.date)}`,
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
        `/clients/${clientId}/registrations/${lawId}/deactivate`,
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
      apiFn.put<void>(`/clients/${clientId}/contacts/${contactId}/primary`),
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
