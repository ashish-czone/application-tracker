import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import type { ReactNode } from 'react';
import { Toaster } from '@packages/ui';
import { EntityEngineProvider } from '@packages/entity-engine-ui';
import { TaxonomyProvider } from '@packages/platform-ui-taxonomy';
import { api } from '../lib/api';
import { SessionExpiredModal } from '../shared/auth/components/SessionExpiredModal';
import { CANDIDATES_UI_CONFIG } from '../entities/candidates.config';

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

const entityUIConfigs = [CANDIDATES_UI_CONFIG];

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <EntityEngineProvider apiFn={api} entityUIConfigs={entityUIConfigs}>
          <TaxonomyProvider apiFn={api}>
            {children}
          </TaxonomyProvider>
        </EntityEngineProvider>
        <Toaster />
        <SessionExpiredModal />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export { queryClient };
