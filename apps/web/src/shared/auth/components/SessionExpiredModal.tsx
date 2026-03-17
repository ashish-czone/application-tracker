import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@packages/ui';
import { authEvents, SESSION_EXPIRED_EVENT } from '../../../lib/api';
import { tokenStore } from '../services/tokenStore';
import { AUTH_QUERY_KEY } from '../hooks/useAuth';

export function SessionExpiredModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleSessionExpired() {
      setOpen(true);
    }
    authEvents.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      authEvents.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  function handleLogin() {
    setOpen(false);
    tokenStore.clearTokens();
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>
            Your session has expired. Please log in again to continue. You can copy any unsaved work before proceeding.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleLogin}>Log in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
