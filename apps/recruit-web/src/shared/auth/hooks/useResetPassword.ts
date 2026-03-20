import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { resetPassword } from '../services/authApi';
import type { ResetPasswordRequest } from '../types';

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => resetPassword(data),
    onSuccess: () => {
      navigate('/login', { replace: true });
    },
  });
}
