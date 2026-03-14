import { useMutation } from '@tanstack/react-query';
import { resetPassword } from '../api/authApi';

export function useResetPassword() {
  return useMutation({
    mutationFn: resetPassword,
  });
}
