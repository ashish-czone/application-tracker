import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router';
import { login } from '../api/authApi';
import { ApiError } from '@packages/api-client';

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user);
      const from = (location.state as { from?: string })?.from || '/';
      navigate(from, { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        return;
      }
      throw error;
    },
  });
}
