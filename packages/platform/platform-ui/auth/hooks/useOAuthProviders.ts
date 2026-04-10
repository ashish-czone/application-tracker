import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePlatformAPI } from '../../PlatformUIProvider';
import { createAuthApi } from '../services';

export const OAUTH_PROVIDERS_QUERY_KEY = ['auth', 'oauth-providers'];

export function useOAuthProviders() {
  const api = usePlatformAPI();
  const authApi = useMemo(() => createAuthApi(api), [api]);

  return useQuery({
    queryKey: OAUTH_PROVIDERS_QUERY_KEY,
    queryFn: () => authApi.getOAuthProviders(),
    staleTime: 5 * 60 * 1000, // 5 minutes — providers don't change often
  });
}
