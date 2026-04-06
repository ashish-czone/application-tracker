import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import type { ReactNode } from 'react';
import { Toaster } from '@packages/ui';
import { EntityEngineProvider, type ColumnRendererRegistration } from '@packages/entity-engine-ui';
import { PipelineProgressInline } from '@packages/platform-ui/workflows';
import { TaxonomyProvider } from '@packages/platform-ui-taxonomy';
import { PlatformUIProvider } from '@packages/platform-ui';
import { api } from '../lib/api';
import { SessionExpiredModal } from '@packages/platform-ui/auth/components/SessionExpiredModal';
import { CANDIDATES_UI_CONFIG } from '../entities/candidates.config';
import { StatusBadgeRenderer } from '../portals/recruiter/features/shared/StatusBadgeRenderer';
import { CandidateNameCell } from '../portals/recruiter/features/shared/CandidateNameCell';

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

const columnRenderers: Record<string, ColumnRendererRegistration> = {
  PipelineProgressRenderer: { component: PipelineProgressInline },
  StatusBadge: { component: StatusBadgeRenderer },
  CandidateNameCell: { component: CandidateNameCell },
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PlatformUIProvider apiFn={api}>
          <EntityEngineProvider apiFn={api} entityUIConfigs={entityUIConfigs} columnRenderers={columnRenderers}>
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
