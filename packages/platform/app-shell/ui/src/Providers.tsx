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
import { PlatformUIProvider } from '@packages/platform-ui';
import { ThemeProvider } from '@packages/theming-ui';
import { useAuth } from '@packages/auth-ui/hooks/useAuth';
import { SessionExpiredModal } from '@packages/auth-ui/components/SessionExpiredModal';
import type { WebFeatureManifest } from '@packages/domains';
import type { ApiFn } from './types';

interface ProvidersProps {
  children: ReactNode;
  apiFn: ApiFn;
  features: WebFeatureManifest[];
  entityUIConfigs: unknown[];
  detailTabs: DetailTabPlugin[];
  rightSidebarPanels: RightSidebarPanel[];
  headerPlugins: HeaderPlugin[];
  columnRenderers: Record<string, ColumnRendererRegistration>;
}

/**
 * Wraps children in each feature manifest's provider, innermost-first in
 * registration order. The first feature in the list ends up closest to
 * children, so later features can read context from earlier ones.
 */
function ComposedFeatureProviders({
  features,
  apiFn,
  children,
}: {
  features: WebFeatureManifest[];
  apiFn: unknown;
  children: ReactNode;
}) {
  let result: ReactNode = children;
  for (let i = features.length - 1; i >= 0; i--) {
    const Provider = features[i].provider;
    if (Provider) {
      result = <Provider apiFn={apiFn}>{result}</Provider>;
    }
  }
  return <>{result}</>;
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
  features,
  entityUIConfigs,
  detailTabs,
  rightSidebarPanels,
  headerPlugins,
  columnRenderers,
}: ProvidersProps) {
  // PlatformUIProvider's ApiFn is the canonical shape; other providers
  // (theming, entity-engine, feature-contributed providers) declare
  // structurally identical but nominally different ApiFn types. Cast to
  // any at provider boundaries — runtime contract is satisfied by
  // createAuthenticatedApi from auth-ui.
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
              columnRenderers={columnRenderers}
            >
              <ComposedFeatureProviders features={features} apiFn={apiAny}>
                {children}
              </ComposedFeatureProviders>
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
