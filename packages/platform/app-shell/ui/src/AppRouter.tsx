import { Suspense, lazy, useState, useMemo, type ReactNode } from 'react';
import { Routes, Route, Navigate, type RouteObject } from 'react-router';
import { AuthGuard } from '@packages/auth-ui/components/AuthGuard';
import { PermissionGuard } from '@packages/auth-ui/components/PermissionGuard';
import { EntityListPage, EntityDetailPage, EntityGroupPage, useEntityConfig, useEntityEngine, groupSlug } from '@packages/entity-engine-ui';
import type { DomainWebManifest, DomainDetailPageComponent, DomainRouteObject, MenuItem } from '@packages/domains';
import type { DetailHeaderActionRenderer } from './types';
import {
  PipelineProgressBar,
  TransitionConfirmDialog,
  WorkflowTransitionButton,
  useWorkflowForEntity,
  useWorkflows,
  useEntityTransition,
} from '@packages/workflows-ui';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/taxonomy-ui';
import { RolesListPage } from '@packages/rbac-ui';
import { AutomationsPage, RuleBuilderPage } from '@packages/automations-ui';
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
}

interface PendingTransition {
  toStateName: string;
  transitionName: string;
  toStateLabel: string;
  reasonOptions?: string[] | null;
  reasonRequired?: boolean;
  commentRequired?: boolean;
}

function useResolvedWorkflow(entityType: string, entityId: string) {
  const { data: allWorkflows } = useWorkflows();
  const anyWorkflow = allWorkflows?.find((w) => w.entityType === entityType && w.isActive);
  const fieldName = anyWorkflow?.fieldName ?? '';
  const { data: resolvedWorkflow } = useWorkflowForEntity(entityType, entityId, fieldName);
  return resolvedWorkflow;
}

function PipelineProgressForEntity({ entityType, entityId, entity }: { entityType: string; entityId: string; entity: Record<string, unknown> }) {
  const resolvedWorkflow = useResolvedWorkflow(entityType, entityId);
  const entityConfig = useEntityConfig(entityType);
  const transitionMutation = useEntityTransition(entityConfig.slug, entityType, entityConfig.singularName);
  const [pending, setPending] = useState<PendingTransition | null>(null);

  if (!resolvedWorkflow) return null;
  const currentState = entity[resolvedWorkflow.fieldName] as string;
  if (!currentState) return null;

  const handleStageClick = (toStateName: string, transitionName: string, toStateLabel: string) => {
    const transition = resolvedWorkflow.transitions.find(
      (t) => t.fromStateName === currentState && t.toStateName === toStateName,
    );
    setPending({
      toStateName, transitionName, toStateLabel,
      reasonOptions: transition?.reasonOptions,
      reasonRequired: transition?.reasonRequired,
      commentRequired: transition?.commentRequired,
    });
  };

  const handleConfirm = ({ reason, comment }: { reason?: string; comment?: string }) => {
    if (!pending) return;
    transitionMutation.mutate(
      { id: entityId, fieldKey: resolvedWorkflow.fieldName, to: pending.toStateName, reason, comment },
      { onSuccess: () => setPending(null) },
    );
  };

  return (
    <>
      <PipelineProgressBar
        workflowSlug={resolvedWorkflow.slug}
        entityType={entityType}
        entityId={entityId}
        currentState={currentState}
        onStageClick={handleStageClick}
      />
      <TransitionConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        transitionName={pending?.transitionName ?? ''}
        toStateLabel={pending?.toStateLabel ?? ''}
        isPending={transitionMutation.isPending}
        reasonOptions={pending?.reasonOptions}
        reasonRequired={pending?.reasonRequired}
        commentRequired={pending?.commentRequired}
        onConfirm={handleConfirm}
      />
    </>
  );
}

function WorkflowActionsForEntity({ entityType, entityId, entity }: { entityType: string; entityId: string; entity: Record<string, unknown> }) {
  const resolvedWorkflow = useResolvedWorkflow(entityType, entityId);
  const entityConfig = useEntityConfig(entityType);
  const transitionMutation = useEntityTransition(entityConfig.slug, entityType, entityConfig.singularName);
  const [pending, setPending] = useState<PendingTransition | null>(null);

  if (!resolvedWorkflow) return null;
  const currentState = entity[resolvedWorkflow.fieldName] as string;
  if (!currentState) return null;

  const handleTransitionSelect = (toStateName: string, transitionName: string, toStateLabel: string) => {
    const transition = resolvedWorkflow.transitions.find(
      (t) => t.fromStateName === currentState && t.toStateName === toStateName,
    );
    setPending({
      toStateName, transitionName, toStateLabel,
      reasonOptions: transition?.reasonOptions,
      reasonRequired: transition?.reasonRequired,
      commentRequired: transition?.commentRequired,
    });
  };

  const handleConfirm = ({ reason, comment }: { reason?: string; comment?: string }) => {
    if (!pending) return;
    transitionMutation.mutate(
      { id: entityId, fieldKey: resolvedWorkflow.fieldName, to: pending.toStateName, reason, comment },
      { onSuccess: () => setPending(null) },
    );
  };

  return (
    <>
      <WorkflowTransitionButton
        workflow={resolvedWorkflow}
        currentState={currentState}
        onTransitionSelect={handleTransitionSelect}
      />
      <TransitionConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        transitionName={pending?.transitionName ?? ''}
        toStateLabel={pending?.toStateLabel ?? ''}
        isPending={transitionMutation.isPending}
        reasonOptions={pending?.reasonOptions}
        reasonRequired={pending?.reasonRequired}
        commentRequired={pending?.commentRequired}
        onConfirm={handleConfirm}
      />
    </>
  );
}

function renderPipelineProgress(entityType: string, entityId: string, entity: Record<string, unknown>) {
  return <PipelineProgressForEntity entityType={entityType} entityId={entityId} entity={entity} />;
}

function renderWorkflowActions(entityType: string, entityId: string, entity: Record<string, unknown>) {
  return <WorkflowActionsForEntity entityType={entityType} entityId={entityId} entity={entity} />;
}

function AppEntityDetailPage({
  entityType,
  detailHeaderActions,
}: {
  entityType: string;
  detailHeaderActions?: Record<string, DetailHeaderActionRenderer>;
}) {
  const actionRenderer = detailHeaderActions?.[entityType];
  const renderHeaderActions = actionRenderer
    ? (_type: string, entityId: string, entity: Record<string, unknown>) =>
        actionRenderer(entityId, entity)
    : undefined;

  return (
    <EntityDetailPage
      entityType={entityType}
      renderPipelineProgress={renderPipelineProgress}
      renderWorkflowActions={renderWorkflowActions}
      renderHeaderActions={renderHeaderActions}
    />
  );
}

const LoginPage = lazy(() => import('@packages/auth-ui/pages/LoginPage'));
const RegisterPage = lazy(() => import('@packages/auth-ui/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@packages/auth-ui/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@packages/auth-ui/pages/ResetPasswordPage'));
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

export function AppRouter({ domains, brandLabel, menuItems, extraRoutes, detailHeaderActions }: AppRouterProps) {
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
      if (entity.ui.groupRenderMode === 'tabs' && entity.ui.navGroup) {
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
                element={Override ? <Suspense fallback={<PageSkeleton />}><Override /></Suspense> : <AppEntityDetailPage entityType={entity.entityType} detailHeaderActions={detailHeaderActions} />}
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
            const gSlug = groupSlug(entity.ui.navGroup!);
            const Override = detailOverrides[entity.entityType];
            return (
              <Route
                key={`${entity.entityType}-detail`}
                path={`/${gSlug}/${entity.slug}/:id`}
                element={Override ? <Suspense fallback={<PageSkeleton />}><Override /></Suspense> : <AppEntityDetailPage entityType={entity.entityType} detailHeaderActions={detailHeaderActions} />}
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
          <Route path="/tag-groups" element={<TagGroupsListPage />} />
          <Route path="/categories" element={<CategoryGroupsListPage />} />
          <Route path="/settings/appearance" element={<Suspense fallback={<PageSkeleton />}><ThemingAppearancePage /></Suspense>} />
          <Route path="/settings/:entityType?" element={<Suspense fallback={<PageSkeleton />}><EntityConfigPage /></Suspense>} />
          <Route path="/app-settings" element={<Suspense fallback={<PageSkeleton />}><AppSettingsPage /></Suspense>} />
          <Route path="/queued-tasks" element={<Suspense fallback={<PageSkeleton />}><QueueDashboardPage /></Suspense>} />
          <Route path="/automations" element={<Suspense fallback={<PageSkeleton />}><AutomationsPage /></Suspense>} />
          <Route path="/automations/create" element={<Suspense fallback={<PageSkeleton />}><RuleBuilderPage /></Suspense>} />
          <Route path="/automations/:id/edit" element={<Suspense fallback={<PageSkeleton />}><RuleBuilderPage /></Suspense>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
