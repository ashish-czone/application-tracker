import { Suspense, lazy, useState, useMemo } from 'react';
import { Routes, Route, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { AuthGuard } from '@packages/platform-ui/auth/components/AuthGuard';
import { EntityListPage, EntityDetailPage, useEntityConfig, useEntityEngine } from '@packages/entity-engine-ui';
import type { DomainWebManifest, DomainDetailPageComponent } from '@packages/domains';
import {
  PipelineProgressBar,
  TransitionConfirmDialog,
  WorkflowTransitionButton,
  useWorkflowForEntity,
  useWorkflows,
  useEntityTransition,
} from '@packages/platform-ui/workflows';
import { SettingsPage, AppearancePage, AppSettingsPage, AutomationsPage, RuleBuilderPage, UsersListPage, RolesListPage, TagGroupsListPage, CategoryGroupsListPage, QueuedTasksPage, OrgPositionsPage, OrgUnitsPage } from '../portals/recruiter/routes';
import { recruitWeb } from '@domains/recruit-ui';

const enabledDomains: DomainWebManifest[] = [recruitWeb];

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

function AppEntityDetailPage({ entityType }: { entityType: string }) {
  return (
    <EntityDetailPage
      entityType={entityType}
      renderPipelineProgress={renderPipelineProgress}
      renderWorkflowActions={renderWorkflowActions}
    />
  );
}

const LoginPage = lazy(() => import('@packages/platform-ui/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@packages/platform-ui/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@packages/platform-ui/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@packages/platform-ui/auth/pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('@packages/platform-ui/auth/pages/ProfilePage'));
const OAuthCallbackPage = lazy(() => import('@packages/platform-ui/auth/pages/OAuthCallbackPage'));

// Dashboard is now in features/dashboard/DashboardPage.tsx

function PageSkeleton() {
  return (
    <div className="space-y-4 p-1">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded bg-muted" />
    </div>
  );
}

/**
 * Merge detailPageOverrides from every enabled domain. First domain wins on conflict.
 */
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

/**
 * Merge routes[] from every enabled domain. First domain wins on path conflict.
 */
function mergeDomainRoutes(domains: DomainWebManifest[]): RouteObject[] {
  const seen = new Set<string>();
  const merged: RouteObject[] = [];
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

export function AppRouter() {
  const { entities } = useEntityEngine();
  const detailOverrides = useMemo(() => mergeDetailOverrides(enabledDomains), []);
  const domainRoutes = useMemo(() => mergeDomainRoutes(enabledDomains), []);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={null}><RegisterPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={null}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />
      <Route path="/oauth/callback" element={<Suspense fallback={null}><OAuthCallbackPage /></Suspense>} />

      {/* Protected routes */}
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route
            path="/profile"
            element={<Suspense fallback={<PageSkeleton />}><ProfilePage /></Suspense>}
          />

          {/* Entity engine routes — list + detail per registered entity.
              Detail overrides come from enabled domains' detailPageOverrides. */}
          {entities.map((entity) => {
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
                element={Override ? <Suspense fallback={<PageSkeleton />}><Override /></Suspense> : <AppEntityDetailPage entityType={entity.entityType} />}
              />,
            ];
          })}

          {/* Domain-contributed routes (dashboard, templates, sub-pages, custom create forms). */}
          {domainRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<Suspense fallback={<PageSkeleton />}>{route.element}</Suspense>}
            />
          ))}

          {/* Non-entity routes */}
          <Route
            path="/users"
            element={<Suspense fallback={<PageSkeleton />}><UsersListPage /></Suspense>}
          />
          <Route
            path="/roles"
            element={<Suspense fallback={<PageSkeleton />}><RolesListPage /></Suspense>}
          />
          <Route
            path="/org-units"
            element={<Suspense fallback={<PageSkeleton />}><OrgUnitsPage /></Suspense>}
          />
          <Route
            path="/org-positions"
            element={<Suspense fallback={<PageSkeleton />}><OrgPositionsPage /></Suspense>}
          />
          <Route
            path="/tag-groups"
            element={<TagGroupsListPage />}
          />
          <Route
            path="/categories"
            element={<CategoryGroupsListPage />}
          />
          <Route
            path="/settings/appearance"
            element={<Suspense fallback={<PageSkeleton />}><AppearancePage /></Suspense>}
          />
          <Route
            path="/settings/:entityType?"
            element={<Suspense fallback={<PageSkeleton />}><SettingsPage /></Suspense>}
          />
          <Route
            path="/app-settings"
            element={<Suspense fallback={<PageSkeleton />}><AppSettingsPage /></Suspense>}
          />
          <Route
            path="/queued-tasks"
            element={<Suspense fallback={<PageSkeleton />}><QueuedTasksPage /></Suspense>}
          />
          <Route
            path="/automations"
            element={<Suspense fallback={<PageSkeleton />}><AutomationsPage /></Suspense>}
          />
          <Route
            path="/automations/create"
            element={<Suspense fallback={<PageSkeleton />}><RuleBuilderPage /></Suspense>}
          />
          <Route
            path="/automations/:id/edit"
            element={<Suspense fallback={<PageSkeleton />}><RuleBuilderPage /></Suspense>}
          />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
