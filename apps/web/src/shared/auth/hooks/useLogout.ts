import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { logout } from '../services/authApi';
import { tokenStore } from '../services/tokenStore';
import { AUTH_QUERY_KEY } from './useAuth';

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      const refreshToken = tokenStore.getRefreshToken();
      if (!refreshToken) return Promise.resolve();
      return logout({ refreshToken });
    },
    onSettled: () => {
      tokenStore.clearTokens();
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}
