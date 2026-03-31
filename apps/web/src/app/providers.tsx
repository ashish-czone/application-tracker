import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import type { ReactNode } from 'react';
import { Toaster } from '@packages/ui';
import { TaxonomyProvider } from '@packages/platform-ui-taxonomy';
import { EntityEngineProvider } from '@packages/entity-engine-ui';
import { PlatformUIProvider } from '@packages/platform-ui';
import { api } from '../lib/api';
import { SessionExpiredModal } from '../shared/auth/components/SessionExpiredModal';

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
        <PlatformUIProvider apiFn={api}>
          <EntityEngineProvider apiFn={api}>
            <TaxonomyProvider apiFn={api}>
              {children}
            </TaxonomyProvider>
          </EntityEngineProvider>
        </PlatformUIProvider>
        <Toaster />
        <SessionExpiredModal />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export { queryClient };
