import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface OfferSummary {
  id: string;
  applicationId: string;
  status: string;
}

export interface OfferApproval {
  id: string;
  offerId: string;
  approverId: string;
  decision: string;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export function useOffersByApplication(applicationId: string | null | undefined, options?: { enabled?: boolean }) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['applications', applicationId, 'offer'],
    queryFn: () =>
      apiFn.get<PaginatedResponse<OfferSummary>>(
        `/offers?applicationId=${applicationId}&limit=1`,
      ),
    enabled: !!applicationId && (options?.enabled ?? true),
  });
}

export function useOffersForJob(jobOpeningId: string | null | undefined) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['job_openings', jobOpeningId, 'offers'],
    queryFn: () => apiFn.get<PaginatedResponse<OfferSummary>>('/offers?limit=100'),
    enabled: !!jobOpeningId,
  });
}

export function useOfferApprovals(offerId: string) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['offers', offerId, 'approvals'],
    queryFn: () => apiFn.get<OfferApproval[]>(`/offers/${offerId}/approvals`),
  });
}

export function useSubmitOfferDecision(offerId: string) {
  const apiFn = usePlatformAPI();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { decision: 'approved' | 'rejected'; comment?: string }) =>
      apiFn.post(`/offers/${offerId}/approvals`, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', offerId, 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      toast.success('Decision submitted');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to submit decision');
    },
  });
}
