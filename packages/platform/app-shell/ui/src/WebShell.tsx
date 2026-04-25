import { useMemo } from 'react';
import type { RouteObject } from 'react-router';
import type {
  ColumnRendererRegistration,
  DetailTabPlugin,
  HeaderPlugin,
  RightSidebarPanel,
} from '@packages/entity-engine-ui';
import type { EntityDetailRenderer, MenuItem } from '@packages/domains';
import { Providers } from './Providers';
import { AppRouter } from './AppRouter';
import { platformMenuItems } from './menu';
import type { WebShellOptions } from './types';

/**
 * Merge entries that target an existing parent (via `parent: '/some-path'`)
 * into that parent's children. Items without a matching parent fall through
 * as top-level entries. Stable: parents preserve their original ordering;
 * orphaned `parent`-keyed items append after the parent's existing children.
 */
function nestMenuItems(items: MenuItem[]): MenuItem[] {
  const topLevel: MenuItem[] = [];
  const orphaned: MenuItem[] = [];
  for (const item of items) {
    if (item.parent) orphaned.push(item);
    else topLevel.push(item);
  }
  if (orphaned.length === 0) return topLevel;
  return topLevel.map((parent) => {
    const adopted = orphaned.filter((o) => o.parent === parent.path);
    if (adopted.length === 0) return parent;
    return {
      ...parent,
      children: [
        ...(parent.children ?? []),
        ...adopted.map(({ parent: _p, ...rest }) => rest),
      ],
    };
  });
}

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
    const flat = [...fromDomains, ...platformMenuItems, ...fromFeatures, ...(extraMenuItems ?? [])];
    return nestMenuItems(flat);
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

  // First feature that supplies a given detail renderer wins. Apps with
  // overlapping features should order their `features` array deliberately.
  const entityDetailRenderers = useMemo(() => {
    let pipelineProgress: EntityDetailRenderer | undefined;
    let workflowActions: EntityDetailRenderer | undefined;
    for (const f of featureList) {
      if (!pipelineProgress && f.entityDetailRenderers?.pipelineProgress) {
        pipelineProgress = f.entityDetailRenderers.pipelineProgress;
      }
      if (!workflowActions && f.entityDetailRenderers?.workflowActions) {
        workflowActions = f.entityDetailRenderers.workflowActions;
      }
    }
    return { pipelineProgress, workflowActions };
  }, [featureList]);

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
        entityDetailRenderers={entityDetailRenderers}
      />
    </Providers>
  );
}
