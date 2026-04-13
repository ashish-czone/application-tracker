import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { usePlatformAPI } from '@packages/platform-ui';
import { createAuthApi } from '../services';
import { tokenStore } from '../tokenStore';
import { useAuth } from './useAuth';
import type { RegisterRequest, AuthUser } from '../types';

export function useRegister() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const api = usePlatformAPI();
  const authApi = useMemo(() => createAuthApi(api), [api]);

  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: (result) => {
      tokenStore.setTokens(result.accessToken, result.refreshToken);
      const payload = tokenStore.decodeAccessToken();
      if (payload) {
        const authUser: AuthUser = {
          userId: payload.userId,
          userType: payload.userType,
          permissions: payload.permissions,
        };
        setSession(authUser);
      }
      navigate('/', { replace: true });
    },
  });
}
