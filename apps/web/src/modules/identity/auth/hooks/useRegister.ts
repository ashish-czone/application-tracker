import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { register } from '../api/authApi';
import { ApiError } from '@packages/api-client';

export function useRegister() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: register,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/', { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        return;
      }
      throw error;
    },
  });
}
