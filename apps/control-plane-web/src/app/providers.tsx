import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import type { ReactNode } from 'react';
import { Toaster } from '@packages/ui';
import { EntityEngineProvider } from '@packages/entity-engine-ui';
import { TaxonomyProvider } from '@packages/taxonomy-ui';
import { PlatformUIProvider } from '@packages/platform-ui';
import { USERS_UI_CONFIG } from '@packages/users-ui';
import { ordersEntityUIConfigs } from '../entity-configs/orders.ui';
import { api } from '../lib/api';

const entityUIConfigs = [USERS_UI_CONFIG, ...ordersEntityUIConfigs];
import { SessionExpiredModal } from '@packages/auth-ui/components/SessionExpiredModal';

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
          <EntityEngineProvider apiFn={api} entityUIConfigs={entityUIConfigs}>
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
