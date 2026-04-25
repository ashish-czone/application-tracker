import { useMemo } from 'react';
import { Providers } from './Providers';
import { AppRouter } from './AppRouter';
import { platformMenuItems } from './menu';
import type { WebShellOptions } from './types';

/**
 * Top-level component that composes the app shell from a list of domain
 * manifests + addon contributions. Each app's main.tsx renders <WebShell />
 * with its specific configuration.
 */
export function WebShell({
  domains,
  apiFn,
  brandLabel,
  extraMenuItems,
  extraRoutes,
  extraEntityUIConfigs,
  extraDetailTabs,
  extraRightSidebarPanels,
  extraHeaderPlugins,
  extraColumnRenderers,
  extraDetailHeaderActions,
}: WebShellOptions) {
  const entityUIConfigs = useMemo(() => {
    const fromDomains = domains.flatMap((d) => d.entityUIConfigs ?? []);
    return [...fromDomains, ...(extraEntityUIConfigs ?? [])];
  }, [domains, extraEntityUIConfigs]);

  const menuItems = useMemo(() => {
    const fromDomains = domains.flatMap((d) => d.menuItems ?? []);
    return [...fromDomains, ...platformMenuItems, ...(extraMenuItems ?? [])];
  }, [domains, extraMenuItems]);

  const detailTabs = useMemo(() => extraDetailTabs ?? [], [extraDetailTabs]);
  const rightSidebarPanels = useMemo(() => extraRightSidebarPanels ?? [], [extraRightSidebarPanels]);
  const headerPlugins = useMemo(() => extraHeaderPlugins ?? [], [extraHeaderPlugins]);
  const columnRenderers = useMemo(() => extraColumnRenderers ?? {}, [extraColumnRenderers]);

  return (
    <Providers
      apiFn={apiFn}
      entityUIConfigs={entityUIConfigs}
      detailTabs={detailTabs}
      rightSidebarPanels={rightSidebarPanels}
      headerPlugins={headerPlugins}
      columnRenderers={columnRenderers}
    >
      <AppRouter
        domains={domains}
        brandLabel={brandLabel}
        menuItems={menuItems}
        extraRoutes={extraRoutes}
        detailHeaderActions={extraDetailHeaderActions}
      />
    </Providers>
  );
}
