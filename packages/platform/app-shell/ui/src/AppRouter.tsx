import { Suspense, lazy, useMemo, type ReactNode } from 'react';
import { Routes, Route, Navigate, type RouteObject } from 'react-router';
import { AuthGuard } from '@packages/auth-ui/components/AuthGuard';
import { PermissionGuard } from '@packages/auth-ui/components/PermissionGuard';
import { EntityListPage, EntityDetailPage, EntityGroupPage, useEntityEngine, groupSlug } from '@packages/entity-engine-ui';
import type {
  DomainWebManifest,
  DomainDetailPageComponent,
  DomainRouteObject,
  EntityConfigTab,
  EntityDetailRenderer,
  MenuItem,
} from '@packages/domains';
import type { DetailHeaderActionRenderer } from './types';
import { RolesListPage } from '@packages/rbac-ui';
import { usersRoutes } from '@packages/users-ui';
import { SettingsPage as AppSettingsPage } from '@packages/settings-ui';
import { QueueDashboardPage } from '@packages/queue-ui';
import { AppearancePage as ThemingAppearancePage } from '@packages/theming-ui';
import { AppLayout } from './AppLayout';
import { EntityConfigPage } from './pages/EntityConfigPage';
import { DashboardPage } from './pages/DashboardPage';

interface AppRouterProps {
  domains: DomainWebManifest[];
  brandLabel: string;
  menuItems: MenuItem[];
  extraRoutes?: RouteObject[];
  /** Per-entity header action renderers — keyed by entityType. */
  detailHeaderActions?: Record<string, DetailHeaderActionRenderer>;
  /**
   * EntityDetailPage slot renderers contributed by `WebShell.features`.
   * Picked first-feature-wins by `WebShell` and passed through here so
   * the router has no direct dependency on any specific feature package.
   */
  entityDetailRenderers?: {
    pipelineProgress?: EntityDetailRenderer;
    workflowActions?: EntityDetailRenderer;
  };
  /**
   * Sub-tabs to add to the entity-config admin page, contributed by
   * features. Each tab decides which entities it applies to via its own
   * `appliesTo` predicate; the router merely forwards the list.
   */
  entityConfigTabs?: EntityConfigTab[];
}

function AppEntityDetailPage({
  entityType,
  detailHeaderActions,
  entityDetailRenderers,
}: {
  entityType: string;
  detailHeaderActions?: Record<string, DetailHeaderActionRenderer>;
  entityDetailRenderers?: {
    pipelineProgress?: EntityDetailRenderer;
    workflowActions?: EntityDetailRenderer;
  };
}) {
  const actionRenderer = detailHeaderActions?.[entityType];
  const renderHeaderActions = actionRenderer
    ? (_type: string, entityId: string, entity: Record<string, unknown>) =>
        actionRenderer(entityId, entity)
    : undefined;

  return (
    <EntityDetailPage
      entityType={entityType}
      renderPipelineProgress={entityDetailRenderers?.pipelineProgress}
      renderWorkflowActions={entityDetailRenderers?.workflowActions}
      renderHeaderActions={renderHeaderActions}
    />
  );
}

const LoginPage = lazy(() => import('@packages/auth-ui/pages/LoginPage'));
const RegisterPage = lazy(() => import('@packages/auth-ui/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@packages/auth-ui/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@packages/auth-ui/pages/ResetPasswordPage'));
const AcceptInvitationPage = lazy(() => import('@packages/auth-ui/pages/AcceptInvitationPage'));
const ProfilePage = lazy(() => import('@packages/auth-ui/pages/ProfilePage'));
const OAuthCallbackPage = lazy(() => import('@packages/auth-ui/pages/OAuthCallbackPage'));

function PageSkeleton() {
  return (
    <div className="space-y-4 p-1">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded bg-muted" />
    </div>
  );
}

function mergeDetailOverrides(domains: DomainWebManifest[]): Record<string, DomainDetailPageComponent> {
  const merged: Record<string, DomainDetailPageComponent> = {};
  for (const domain of domains) {
    for (const [entityType, component] of Object.entries(domain.detailPageOverrides ?? {})) {
      if (merged[entityType]) {
        console.warn(`[domains] duplicate detailPageOverride for "${entityType}" — keeping the first`);
        continue;
      }
      merged[entityType] = component;
    }
  }
  return merged;
}

function mergeDomainRoutes(domains: DomainWebManifest[]): DomainRouteObject[] {
  const seen = new Set<string>();
  const merged: DomainRouteObject[] = [];
  for (const domain of domains) {
    for (const route of domain.routes ?? []) {
      if (route.path && seen.has(route.path)) {
        console.warn(`[domains] duplicate route "${route.path}" — keeping the first`);
        continue;
      }
      if (route.path) seen.add(route.path);
      merged.push(route);
    }
  }
  return merged;
}

function withPermission(element: ReactNode, permission?: string): ReactNode {
  if (!permission) return element;
  return <PermissionGuard permission={permission}>{element}</PermissionGuard>;
}

export function AppRouter({ domains, brandLabel, menuItems, extraRoutes, detailHeaderActions, entityDetailRenderers, entityConfigTabs }: AppRouterProps) {
  const { entities } = useEntityEngine();
  const detailOverrides = useMemo(() => mergeDetailOverrides(domains), [domains]);
  const domainRoutes = useMemo(() => mergeDomainRoutes(domains), [domains]);
  const allExtraRoutes = useMemo(() => extraRoutes ?? [], [extraRoutes]);

  const bareDomainRoutes = useMemo(
    () => domainRoutes.filter((r) => r.bareLayout),
    [domainRoutes],
  );
  const wrappedDomainRoutes = useMemo(
    () => domainRoutes.filter((r) => !r.bareLayout),
    [domainRoutes],
  );

  const domainHasDashboard = useMemo(
    () => domainRoutes.some((r) => r.path === '/dashboard'),
    [domainRoutes],
  );

  // A domain route like `/clients` or `/clients/:clientId` claims the `clients`
  // slug — skip the auto-generated entity list/detail routes for those slugs
  // so the designed domain page wins.
  const domainOwnedSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const r of domainRoutes) {
      if (typeof r.path !== 'string') continue;
      const top = r.path.split('/').filter(Boolean)[0];
      if (top) slugs.add(top);
    }
    return slugs;
  }, [domainRoutes]);

  // Split entities into standalone and grouped (tabbed). Grouped entities
  // are mounted under their group slug (`/content/:entitySlug`) and their
  // list view lives inside EntityGroupPage; the detail route still renders
  // full-screen outside the tabs at `/content/{entitySlug}/:id`.
  const { standaloneEntities, groupedEntities, entityGroups } = useMemo(() => {
    const standalone: typeof entities = [];
    const grouped: typeof entities = [];
    const groupMap = new Map<string, { slug: string; navGroup: string }>();

    for (const entity of entities) {
      if (domainOwnedSlugs.has(entity.slug)) continue;
      if (entity.ui?.groupRenderMode === 'tabs' && entity.ui?.navGroup) {
        const slug = groupSlug(entity.ui.navGroup);
        if (domainOwnedSlugs.has(slug)) {
          standalone.push(entity);
          continue;
        }
        grouped.push(entity);
        if (!groupMap.has(slug)) {
          groupMap.set(slug, { slug, navGroup: entity.ui.navGroup });
        }
      } else {
        standalone.push(entity);
      }
    }

    return {
      standaloneEntities: standalone,
      groupedEntities: grouped,
      entityGroups: Array.from(groupMap.values()),
    };
  }, [entities, domainOwnedSlugs]);

  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={null}><RegisterPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={null}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />
      <Route path="/accept-invitation" element={<Suspense fallback={null}><AcceptInvitationPage /></Suspense>} />
      <Route path="/oauth/callback" element={<Suspense fallback={null}><OAuthCallbackPage /></Suspense>} />

      <Route element={<AuthGuard />}>
        {bareDomainRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Suspense fallback={<PageSkeleton />}>
                {withPermission(route.element, route.permission)}
              </Suspense>
            }
          />
        ))}

        <Route element={<AppLayout brandLabel={brandLabel} menuItems={menuItems} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          {!domainHasDashboard && (
            <Route path="/dashboard" element={<DashboardPage brandLabel={brandLabel} />} />
          )}
          <Route path="/profile" element={<Suspense fallback={<PageSkeleton />}><ProfilePage /></Suspense>} />

          {wrappedDomainRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <Suspense fallback={<PageSkeleton />}>
                  {withPermission(route.element, route.permission)}
                </Suspense>
              }
            />
          ))}

          {standaloneEntities.map((entity) => {
            const Override = detailOverrides[entity.entityType];
            return [
              <Route
                key={`${entity.entityType}-list`}
                path={`/${entity.slug}`}
                element={<EntityListPage entityType={entity.entityType} />}
              />,
              <Route
                key={`${entity.entityType}-detail`}
                path={`/${entity.slug}/:id`}
                element={Override ? <Suspense fallback={<PageSkeleton />}><Override /></Suspense> : <AppEntityDetailPage entityType={entity.entityType} detailHeaderActions={detailHeaderActions} entityDetailRenderers={entityDetailRenderers} />}
              />,
            ];
          })}

          {entityGroups.map((group) => [
            <Route
              key={`group-${group.slug}-root`}
              path={`/${group.slug}`}
              element={<EntityGroupPage groupSlugPath={group.slug} />}
            />,
            <Route
              key={`group-${group.slug}-tab`}
              path={`/${group.slug}/:entitySlug`}
              element={<EntityGroupPage groupSlugPath={group.slug} />}
            />,
          ])}

          {groupedEntities.map((entity) => {
            const gSlug = groupSlug(entity.ui!.navGroup!);
            const Override = detailOverrides[entity.entityType];
            return (
              <Route
                key={`${entity.entityType}-detail`}
                path={`/${gSlug}/${entity.slug}/:id`}
                element={Override ? <Suspense fallback={<PageSkeleton />}><Override /></Suspense> : <AppEntityDetailPage entityType={entity.entityType} detailHeaderActions={detailHeaderActions} entityDetailRenderers={entityDetailRenderers} />}
              />
            );
          })}

          {allExtraRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<Suspense fallback={<PageSkeleton />}>{route.element}</Suspense>}
            />
          ))}

          {usersRoutes}
          <Route path="/roles" element={<Suspense fallback={<PageSkeleton />}><RolesListPage /></Suspense>} />
          <Route path="/settings/appearance" element={<Suspense fallback={<PageSkeleton />}><ThemingAppearancePage /></Suspense>} />
          <Route path="/settings/:entityType?" element={<Suspense fallback={<PageSkeleton />}><EntityConfigPage entityConfigTabs={entityConfigTabs} /></Suspense>} />
          <Route path="/app-settings" element={<Suspense fallback={<PageSkeleton />}><AppSettingsPage /></Suspense>} />
          <Route path="/queued-tasks" element={<Suspense fallback={<PageSkeleton />}><QueueDashboardPage /></Suspense>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
