import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usePlatformAPI } from '../../PlatformUIProvider';
import { createAuthApi } from '../services';
import type { ForgotPasswordRequest } from '../types';

export function useForgotPassword() {
  const api = usePlatformAPI();
  const authApi = useMemo(() => createAuthApi(api), [api]);

  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) => authApi.forgotPassword(data),
  });
}
