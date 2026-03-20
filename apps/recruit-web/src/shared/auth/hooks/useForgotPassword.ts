import { useMutation } from '@tanstack/react-query';
import { forgotPassword } from '../services/authApi';
import type { ForgotPasswordRequest } from '../types';

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) => forgotPassword(data),
  });
}
