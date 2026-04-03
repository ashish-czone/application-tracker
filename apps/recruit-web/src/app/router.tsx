import { Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { AuthGuard } from '@packages/platform-ui/auth/components/AuthGuard';
import { EntityListPage, EntityCreatePage, EntityDetailPage, useEntityConfig } from '@packages/entity-engine-ui';
import { AuditTimeline } from '@packages/platform-ui/audit';
import {
  PipelineProgressBar,
  TransitionConfirmDialog,
  WorkflowTransitionButton,
  useWorkflowForEntity,
  useWorkflows,
  useEntityTransition,
} from '@packages/platform-ui/workflows';
import { SettingsPage, AppSettingsPage, AutomationsPage, RuleBuilderPage, UsersListPage, RolesListPage, TagGroupsListPage, CategoryGroupsListPage, QueuedTasksPage } from '../portals/recruiter/routes';

function renderAuditTrail(entityType: string, entityId: string) {
  return <AuditTimeline entityType={entityType} entityId={entityId} />;
}

interface PendingTransition {
  toStateName: string;
  transitionName: string;
  toStateLabel: string;
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
    setPending({ toStateName, transitionName, toStateLabel });
  };

  const handleConfirm = (comment?: string) => {
    if (!pending) return;
    transitionMutation.mutate(
      { id: entityId, fieldKey: resolvedWorkflow.fieldName, to: pending.toStateName, comment },
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
    setPending({ toStateName, transitionName, toStateLabel });
  };

  const handleConfirm = (comment?: string) => {
    if (!pending) return;
    transitionMutation.mutate(
      { id: entityId, fieldKey: resolvedWorkflow.fieldName, to: pending.toStateName, comment },
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
      renderAuditTrail={renderAuditTrail}
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

function DashboardPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Welcome back</p>
      </div>
    </div>
  );
}

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
 * Entity routes rendered via the engine's generic pages.
 * Each entity gets /{slug} (list) and /{slug}/:id (detail) automatically.
 * Adding a new entity here = 2 lines.
 */
function EntityRoutes({ entityType }: { entityType: string }) {
  return (
    <>
      <Route path={`/${entityType}`} element={<EntityListPage entityType={entityType} />} />
      <Route path={`/${entityType}/:id`} element={<AppEntityDetailPage entityType={entityType} />} />
    </>
  );
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={null}><RegisterPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={null}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />

      {/* Protected routes */}
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/profile"
            element={<Suspense fallback={<PageSkeleton />}><ProfilePage /></Suspense>}
          />

          {/* Entity engine routes — each entity = 2 lines */}
          <Route path="/job-openings" element={<EntityListPage entityType="job_openings" />} />
          <Route path="/job-openings/new" element={<EntityCreatePage entityType="job_openings" />} />
          <Route path="/job-openings/:id" element={<AppEntityDetailPage entityType="job_openings" />} />
          <Route path="/candidates" element={<EntityListPage entityType="candidates" />} />
          <Route path="/candidates/:id" element={<AppEntityDetailPage entityType="candidates" />} />
          <Route path="/interviews" element={<EntityListPage entityType="interviews" />} />
          <Route path="/interviews/:id" element={<AppEntityDetailPage entityType="interviews" />} />
          <Route path="/clients" element={<EntityListPage entityType="clients" />} />
          <Route path="/clients/:id" element={<AppEntityDetailPage entityType="clients" />} />
          <Route path="/contacts" element={<EntityListPage entityType="contacts" />} />
          <Route path="/contacts/:id" element={<AppEntityDetailPage entityType="contacts" />} />
          <Route path="/vendors" element={<EntityListPage entityType="vendors" />} />
          <Route path="/vendors/:id" element={<AppEntityDetailPage entityType="vendors" />} />
          <Route path="/applications" element={<EntityListPage entityType="applications" />} />
          <Route path="/applications/:id" element={<AppEntityDetailPage entityType="applications" />} />

          {/* Tasks — now via entity engine */}
          <Route path="/tasks" element={<EntityListPage entityType="tasks" />} />
          <Route path="/tasks/:id" element={<AppEntityDetailPage entityType="tasks" />} />

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
            path="/tag-groups"
            element={<TagGroupsListPage />}
          />
          <Route
            path="/categories"
            element={<CategoryGroupsListPage />}
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
