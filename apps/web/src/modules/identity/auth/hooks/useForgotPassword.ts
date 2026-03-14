import { useMutation } from '@tanstack/react-query';
import { forgotPassword } from '../api/authApi';

export function useForgotPassword() {
  return useMutation({
    mutationFn: forgotPassword,
  });
}
