import { Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { AuthGuard } from '@packages/platform-ui/auth/components/AuthGuard';
import { EntityListPage, EntityDetailPage, useEntityConfig } from '@packages/entity-engine-ui';
import { AuditTimeline } from '@packages/platform-ui/audit';
import {
  PipelineProgressBar,
  TransitionConfirmDialog,
  WorkflowTransitionButton,
  useWorkflowForEntity,
  useWorkflows,
  useEntityTransition,
} from '@packages/platform-ui/workflows';
import { UsersListPage, RolesListPage, AppSettingsPage } from '../portals/admin/routes';
import { TenantsListPage } from '../portals/admin/features/tenants/TenantsListPage';
import { TenantDetailPage } from '../portals/admin/features/tenants/TenantDetailPage';

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
const ForgotPasswordPage = lazy(() => import('@packages/platform-ui/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@packages/platform-ui/auth/pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('@packages/platform-ui/auth/pages/ProfilePage'));

function DashboardPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Control Plane Dashboard</p>
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

export function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
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

          {/* Entity engine routes */}
          <Route path="/clients" element={<EntityListPage entityType="clients" />} />
          <Route path="/clients/:id" element={<AppEntityDetailPage entityType="clients" />} />
          <Route path="/orders" element={<EntityListPage entityType="orders" />} />
          <Route path="/orders/:id" element={<AppEntityDetailPage entityType="orders" />} />
          <Route path="/subscription-plans" element={<EntityListPage entityType="subscription-plans" />} />
          <Route path="/subscription-plans/:id" element={<AppEntityDetailPage entityType="subscription-plans" />} />
          <Route path="/subscriptions" element={<EntityListPage entityType="subscriptions" />} />
          <Route path="/subscriptions/:id" element={<AppEntityDetailPage entityType="subscriptions" />} />

          {/* Custom routes */}
          <Route path="/tenants" element={<TenantsListPage />} />
          <Route path="/tenants/:id" element={<TenantDetailPage />} />

          {/* Platform routes */}
          <Route
            path="/users"
            element={<Suspense fallback={<PageSkeleton />}><UsersListPage /></Suspense>}
          />
          <Route
            path="/roles"
            element={<Suspense fallback={<PageSkeleton />}><RolesListPage /></Suspense>}
          />
          <Route
            path="/settings"
            element={<Suspense fallback={<PageSkeleton />}><AppSettingsPage /></Suspense>}
          />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
