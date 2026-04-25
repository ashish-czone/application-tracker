import { useState } from 'react';
import { useEntityConfig } from '@packages/entity-engine-ui';
import { PipelineProgressBar } from './PipelineProgressBar';
import { TransitionConfirmDialog } from './TransitionConfirmDialog';
import { WorkflowTransitionButton } from './WorkflowTransitionButton';
import {
  useWorkflowForEntity,
  useWorkflows,
  useEntityTransition,
  useTransitionPreflight,
} from '../hooks';

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

function PreflightedTransitionDialog({
  workflowSlug,
  entityType,
  entityId,
  fromState,
  pending,
  isPending,
  onCancel,
  onConfirm,
}: {
  workflowSlug: string;
  entityType: string;
  entityId: string;
  fromState: string;
  pending: PendingTransition | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (data: { reason?: string; comment?: string }) => void;
}) {
  const preflightParams = pending
    ? { workflowSlug, entityType, entityId, fromState, toState: pending.toStateName }
    : null;
  const { data: preflight, isFetching: preflightLoading } = useTransitionPreflight(preflightParams);

  return (
    <TransitionConfirmDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      transitionName={pending?.transitionName ?? ''}
      toStateLabel={pending?.toStateLabel ?? ''}
      isPending={isPending}
      reasonOptions={pending?.reasonOptions}
      reasonRequired={pending?.reasonRequired}
      commentRequired={pending?.commentRequired}
      warnings={preflight?.warnings}
      blockers={preflight?.blockers}
      preflightLoading={preflightLoading}
      onConfirm={onConfirm}
    />
  );
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
      <PreflightedTransitionDialog
        workflowSlug={resolvedWorkflow.slug}
        entityType={entityType}
        entityId={entityId}
        fromState={currentState}
        pending={pending}
        isPending={transitionMutation.isPending}
        onCancel={() => setPending(null)}
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
      <PreflightedTransitionDialog
        workflowSlug={resolvedWorkflow.slug}
        entityType={entityType}
        entityId={entityId}
        fromState={currentState}
        pending={pending}
        isPending={transitionMutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export function renderPipelineProgress(entityType: string, entityId: string, entity: Record<string, unknown>) {
  return <PipelineProgressForEntity entityType={entityType} entityId={entityId} entity={entity} />;
}

export function renderWorkflowActions(entityType: string, entityId: string, entity: Record<string, unknown>) {
  return <WorkflowActionsForEntity entityType={entityType} entityId={entityId} entity={entity} />;
}
