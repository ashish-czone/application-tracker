import { useQuery } from '@tanstack/react-query';
import { usePlatformAPI } from '@packages/platform-ui';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CountResponse {
  meta: { total: number };
}

export interface UpcomingInterview {
  id: string;
  interviewName: string;
  candidateId__label: string;
  jobOpeningId__label: string;
  interviewFrom: string;
  status: string;
}

export interface JobInterview {
  id: string;
  candidateId: string;
  jobOpeningId: string;
  status: string;
  interviewFrom: string;
}

export function useInterviewsCount() {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['dashboard', 'interviews'],
    queryFn: () => apiFn.get<CountResponse>('/interviews?limit=1'),
  });
}

export function useUpcomingInterviews(limit = 5) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['dashboard', 'upcoming-interviews', limit],
    queryFn: () =>
      apiFn.get<PaginatedResponse<UpcomingInterview>>(
        `/interviews?limit=${limit}&sort=interviewFrom&order=asc&status=scheduled`,
      ),
  });
}

export function useInterviewsByJobOpening(jobOpeningId: string | null | undefined) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['job_openings', jobOpeningId, 'interviews'],
    queryFn: () =>
      apiFn.get<PaginatedResponse<JobInterview>>(
        `/interviews?jobOpeningId=${jobOpeningId}&limit=200`,
      ),
    enabled: !!jobOpeningId,
  });
}

export function useInterviewsCalendar(dateRange: { start: Date; end: Date } | null) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: [
      'interviews',
      'calendar',
      dateRange?.start?.toISOString(),
      dateRange?.end?.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '200',
        sort: 'interviewFrom',
        order: 'asc',
      });
      if (dateRange) {
        params.set(
          'filters',
          JSON.stringify([
            { field: 'interviewFrom', operator: 'gte', value: dateRange.start.toISOString() },
            { field: 'interviewFrom', operator: 'lte', value: dateRange.end.toISOString() },
          ]),
        );
      }
      return apiFn.get<PaginatedResponse<Record<string, unknown>>>(`/interviews?${params}`);
    },
    enabled: !!dateRange,
  });
}
