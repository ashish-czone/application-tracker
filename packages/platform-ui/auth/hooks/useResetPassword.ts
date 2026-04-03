import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { usePlatformAPI } from '../../PlatformUIProvider';
import { createAuthApi } from '../services';
import type { ResetPasswordRequest } from '../types';

export function useResetPassword() {
  const navigate = useNavigate();
  const api = usePlatformAPI();
  const authApi = useMemo(() => createAuthApi(api), [api]);

  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => authApi.resetPassword(data),
    onSuccess: () => {
      navigate('/login', { replace: true });
    },
  });
}
