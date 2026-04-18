import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      const message =
        (error as { body?: { message?: string } })?.body?.message ??
        'Failed to save law registrations';
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
