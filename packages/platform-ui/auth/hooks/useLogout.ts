import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { usePlatformAPI } from '../../PlatformUIProvider';
import { createAuthApi } from '../services';
import { tokenStore } from '../tokenStore';
import { AUTH_QUERY_KEY } from './useAuth';

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const api = usePlatformAPI();
  const authApi = useMemo(() => createAuthApi(api), [api]);

  return useMutation({
    mutationFn: () => {
      const refreshToken = tokenStore.getRefreshToken();
      if (!refreshToken) return Promise.resolve();
      return authApi.logout({ refreshToken });
    },
    onSettled: () => {
      tokenStore.clearTokens();
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}
