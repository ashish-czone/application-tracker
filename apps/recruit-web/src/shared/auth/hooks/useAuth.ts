import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tokenStore } from '../services/tokenStore';
import { refreshTokens } from '../services/authApi';
import type { AuthUser } from '../types';

export const AUTH_QUERY_KEY = ['auth', 'session'] as const;

/**
 * Resolves the current auth session:
 * 1. If a valid access token exists in memory, decode it.
 * 2. If expired but refresh token exists, attempt silent refresh.
 * 3. Otherwise, return null (unauthenticated).
 */
async function resolveAuthSession(): Promise<AuthUser | null> {
  const payload = tokenStore.decodeAccessToken();
  if (payload) {
    return {
      userId: payload.userId,
      userType: payload.userType,
      permissions: payload.permissions,
    };
  }

  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const result = await refreshTokens({ refreshToken });
    tokenStore.setTokens(result.accessToken, result.refreshToken);
    const newPayload = tokenStore.decodeAccessToken();
    if (newPayload) {
      return {
        userId: newPayload.userId,
        userType: newPayload.userType,
        permissions: newPayload.permissions,
      };
    }
  } catch {
    tokenStore.clearTokens();
  }

  return null;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: resolveAuthSession,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isAuthenticated = !!user;

  function can(permission: string): boolean {
    if (!user?.permissions) return false;
    return permission in user.permissions || '*' in user.permissions;
  }

  function setSession(authUser: AuthUser | null): void {
    queryClient.setQueryData(AUTH_QUERY_KEY, authUser);
  }

  return {
    user: user ?? null,
    isAuthenticated,
    isLoading,
    can,
    setSession,
  };
}
