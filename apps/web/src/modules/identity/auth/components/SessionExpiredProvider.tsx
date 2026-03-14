import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStore } from '@packages/api-client';
import { SessionExpiredModal } from '@packages/auth-ui';
import { setSessionExpiredCallback } from '../../../../lib/api';

export function SessionExpiredProvider({ children }: { children: ReactNode }) {
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    setSessionExpiredCallback(() => {
      setIsSessionExpired(true);
    });

    return () => {
      setSessionExpiredCallback(() => {});
    };
  }, []);

  function handleLogin() {
    setIsSessionExpired(false);
    tokenStore.clearToken();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  return (
    <>
      {children}
      <SessionExpiredModal isOpen={isSessionExpired} onLogin={handleLogin} />
    </>
  );
}
