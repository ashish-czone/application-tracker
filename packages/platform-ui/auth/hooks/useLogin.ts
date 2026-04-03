import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { usePlatformAPI } from '../../PlatformUIProvider';
import { createAuthApi } from '../services';
import { tokenStore } from '../tokenStore';
import { useAuth } from './useAuth';
import type { LoginRequest, AuthUser } from '../types';

export function useLogin() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const api = usePlatformAPI();
  const authApi = useMemo(() => createAuthApi(api), [api]);

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
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
