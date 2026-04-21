import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { usePlatformAPI } from '@packages/platform-ui';
import { createAuthApi } from '../services';
import { tokenStore } from '../tokenStore';
import { useAuth } from './useAuth';
import type { AcceptInvitationRequest, AuthUser } from '../types';

/**
 * Accepts an invitation token + chosen password, mints a session for the
 * invited user, and navigates to the app root. Mirrors `useLogin` — the
 * backend stamps `acceptedAt` + `lastLoginAt` in the same transaction.
 */
export function useAcceptInvitation() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const api = usePlatformAPI();
  const authApi = useMemo(() => createAuthApi(api), [api]);

  return useMutation({
    mutationFn: (data: AcceptInvitationRequest) => authApi.acceptInvitation(data),
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
