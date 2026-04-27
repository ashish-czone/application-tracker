import { useQuery } from '@tanstack/react-query';
import { usePlatformAPI } from '@packages/platform-ui';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ApplicationListItem {
  id: string;
  candidateId: string;
  candidateId__label: string;
  jobOpeningId: string;
  jobOpeningId__label: string;
  stage: string;
  source: string;
  averageRating: number | null;
  evaluationsCount: number | null;
  referredBy: string | null;
  referredBy__label: string | null;
  createdAt: string;
}

export interface CrossJobApplication {
  candidateId: string;
  jobOpeningId: string;
  stage: string;
}

export function useApplicationsByCandidate(candidateId: string | null | undefined) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['candidates', candidateId, 'applications'],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ApplicationListItem>>(
        `/applications?candidateId=${candidateId}&limit=50`,
      ),
    enabled: !!candidateId,
  });
}

export function useApplicationsByJobOpening(jobOpeningId: string | null | undefined) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['job_openings', jobOpeningId, 'applications'],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ApplicationListItem>>(
        `/applications?jobOpeningId=${jobOpeningId}&limit=100`,
      ),
    enabled: !!jobOpeningId,
  });
}

export function useAllApplications(limit = 500) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['dashboard', 'all-applications', limit],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ApplicationListItem>>(`/applications?limit=${limit}`),
  });
}

export function useCrossJobApplications(candidateIds: string[]) {
  const apiFn = usePlatformAPI();
  const sortedKey = candidateIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['cross-job-applications', sortedKey],
    queryFn: () =>
      apiFn.get<PaginatedResponse<CrossJobApplication>>('/applications?limit=500'),
    enabled: candidateIds.length > 0,
    staleTime: 60_000,
  });
}
