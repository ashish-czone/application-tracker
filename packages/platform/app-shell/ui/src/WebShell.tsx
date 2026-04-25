import { useMemo } from 'react';
import type { RouteObject } from 'react-router';
import type {
  ColumnRendererRegistration,
  DetailTabPlugin,
  HeaderPlugin,
  RightSidebarPanel,
} from '@packages/entity-engine-ui';
import { Providers } from './Providers';
import { AppRouter } from './AppRouter';
import { platformMenuItems } from './menu';
import type { WebShellOptions } from './types';

/**
 * Top-level component that composes the app shell from a list of domain
 * manifests + frontend feature manifests + app-level extras. Each app's
 * main.tsx renders <WebShell /> with its specific configuration.
 */
export function WebShell({
  domains,
  apiFn,
  brandLabel,
  features,
  extraMenuItems,
  extraRoutes,
  extraEntityUIConfigs,
  extraDetailTabs,
  extraRightSidebarPanels,
  extraHeaderPlugins,
  extraColumnRenderers,
  extraDetailHeaderActions,
}: WebShellOptions) {
  const featureList = features ?? [];

  const entityUIConfigs = useMemo(() => {
    const fromDomains = domains.flatMap((d) => d.entityUIConfigs ?? []);
    const fromFeatures = featureList.flatMap((f) => f.entityUIConfigs ?? []);
    return [...fromDomains, ...fromFeatures, ...(extraEntityUIConfigs ?? [])];
  }, [domains, featureList, extraEntityUIConfigs]);

  const menuItems = useMemo(() => {
    const fromDomains = domains.flatMap((d) => d.menuItems ?? []);
    const fromFeatures = featureList.flatMap((f) => f.menuItems ?? []);
    return [...fromDomains, ...platformMenuItems, ...fromFeatures, ...(extraMenuItems ?? [])];
  }, [domains, featureList, extraMenuItems]);

  const detailTabs = useMemo<DetailTabPlugin[]>(() => {
    const fromFeatures = featureList.flatMap((f) => f.detailTabs ?? []) as DetailTabPlugin[];
    return [...fromFeatures, ...(extraDetailTabs ?? [])];
  }, [featureList, extraDetailTabs]);

  const rightSidebarPanels = useMemo<RightSidebarPanel[]>(() => {
    const fromFeatures = featureList.flatMap((f) => f.rightSidebarPanels ?? []) as RightSidebarPanel[];
    return [...fromFeatures, ...(extraRightSidebarPanels ?? [])];
  }, [featureList, extraRightSidebarPanels]);

  const headerPlugins = useMemo<HeaderPlugin[]>(() => {
    const fromFeatures = featureList.flatMap((f) => f.headerPlugins ?? []) as HeaderPlugin[];
    return [...fromFeatures, ...(extraHeaderPlugins ?? [])];
  }, [featureList, extraHeaderPlugins]);

  const columnRenderers = useMemo<Record<string, ColumnRendererRegistration>>(() => {
    const merged: Record<string, ColumnRendererRegistration> = {};
    for (const f of featureList) {
      Object.assign(merged, (f.columnRenderers ?? {}) as Record<string, ColumnRendererRegistration>);
    }
    Object.assign(merged, extraColumnRenderers ?? {});
    return merged;
  }, [featureList, extraColumnRenderers]);

  const allExtraRoutes = useMemo<RouteObject[]>(() => {
    const fromFeatures = featureList.flatMap((f) => f.routes ?? []);
    return [...fromFeatures, ...(extraRoutes ?? [])];
  }, [featureList, extraRoutes]);

  return (
    <Providers
      apiFn={apiFn}
      features={featureList}
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
        extraRoutes={allExtraRoutes}
        detailHeaderActions={extraDetailHeaderActions}
      />
    </Providers>
  );
}
