import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { register } from '../services/authApi';
import { tokenStore } from '../services/tokenStore';
import { useAuth } from './useAuth';
import type { RegisterRequest, AuthUser } from '../types';

export function useRegister() {
  const navigate = useNavigate();
  const { setSession } = useAuth();

  return useMutation({
    mutationFn: (data: RegisterRequest) => register(data),
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
