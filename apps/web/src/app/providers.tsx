import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { SessionExpiredProvider } from '@modules/identity/auth/components/SessionExpiredProvider';
import { PermissionsProvider } from '@modules/identity/auth/components/PermissionsProvider';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionExpiredProvider>
          <PermissionsProvider>{children}</PermissionsProvider>
        </SessionExpiredProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export { queryClient };
