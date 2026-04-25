import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import type { ReactNode } from 'react';
import { Toaster } from '@packages/ui';
import {
  EntityEngineProvider,
  type ColumnRendererRegistration,
  type DetailTabPlugin,
  type EntityUIConfig,
  type HeaderPlugin,
  type RightSidebarPanel,
} from '@packages/entity-engine-ui';
import { PipelineProgressInline } from '@packages/workflows-ui';
import { TaxonomyProvider } from '@packages/taxonomy-ui';
import { PlatformUIProvider } from '@packages/platform-ui';
import { ThemeProvider } from '@packages/theming-ui';
import { useAuth } from '@packages/auth-ui/hooks/useAuth';
import { SessionExpiredModal } from '@packages/auth-ui/components/SessionExpiredModal';
import type { ApiFn } from './types';

interface ProvidersProps {
  children: ReactNode;
  apiFn: ApiFn;
  entityUIConfigs: unknown[];
  detailTabs: DetailTabPlugin[];
  rightSidebarPanels: RightSidebarPanel[];
  headerPlugins: HeaderPlugin[];
  columnRenderers: Record<string, ColumnRendererRegistration>;
}

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

function AuthGatedThemeProvider({ apiFn, children }: { apiFn: any; children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <ThemeProvider apiFn={apiFn} enabled={isAuthenticated}>
      {children}
    </ThemeProvider>
  );
}

export function Providers({
  children,
  apiFn,
  entityUIConfigs,
  detailTabs,
  rightSidebarPanels,
  headerPlugins,
  columnRenderers,
}: ProvidersProps) {
  const renderers: Record<string, ColumnRendererRegistration> = {
    PipelineProgressRenderer: { component: PipelineProgressInline },
    ...columnRenderers,
  };

  // PlatformUIProvider's ApiFn is the canonical shape; other providers
  // (taxonomy, theming, entity-engine) declare structurally identical but
  // nominally different ApiFn types. Cast to any at provider boundaries —
  // runtime contract is satisfied by createAuthenticatedApi from auth-ui.
  const apiAny = apiFn as any;

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PlatformUIProvider apiFn={apiFn}>
          <AuthGatedThemeProvider apiFn={apiAny}>
            <EntityEngineProvider
              apiFn={apiAny}
              entityUIConfigs={entityUIConfigs as EntityUIConfig[]}
              detailTabs={detailTabs}
              rightSidebarPanels={rightSidebarPanels}
              headerPlugins={headerPlugins}
              columnRenderers={renderers}
            >
              <TaxonomyProvider apiFn={apiAny}>
                {children}
              </TaxonomyProvider>
            </EntityEngineProvider>
          </AuthGatedThemeProvider>
        </PlatformUIProvider>
        <Toaster />
        <SessionExpiredModal />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export { queryClient };
