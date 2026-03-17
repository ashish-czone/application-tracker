import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { login } from '../services/authApi';
import { tokenStore } from '../services/tokenStore';
import { useAuth } from './useAuth';
import type { LoginRequest, AuthUser } from '../types';

export function useLogin() {
  const navigate = useNavigate();
  const { setSession } = useAuth();

  return useMutation({
    mutationFn: (data: LoginRequest) => login(data),
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
