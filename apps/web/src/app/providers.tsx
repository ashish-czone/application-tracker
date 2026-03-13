import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { SessionExpiredProvider } from '@modules/users/auth/components/SessionExpiredProvider';
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
        <SessionExpiredProvider>{children}</SessionExpiredProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export { queryClient };
