import { useQuery } from '@tanstack/react-query';
import { usePlatformAPI } from '@packages/platform-ui';

interface CountResponse {
  meta: { total: number };
}

export function useJobOpeningsCount() {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['dashboard', 'jobs'],
    queryFn: () => apiFn.get<CountResponse>('/job-openings?limit=1'),
  });
}
