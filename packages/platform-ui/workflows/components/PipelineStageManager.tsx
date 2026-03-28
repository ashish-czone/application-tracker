import { useState, useMemo } from 'react';
import { Plus, GripVertical, Pencil, Trash2, Workflow } from 'lucide-react';
import { Button, ConfirmDialog, Badge } from '@packages/ui';
import type { Condition, ConditionFieldConfig } from '../../conditions';
import { useWorkflow, useCreateState, useUpdateState, useDeleteState, useCreateTransition, useDeleteTransition, useUpdateTransition } from '../hooks';
import { StageForm } from './StageForm';
import { StageTransitionEditor } from './StageTransitionEditor';
import type { WorkflowState } from '../types';

interface PipelineStageManagerProps {
  workflowSlug: string;
  availablePermissions?: string[];
  entityFields?: Record<string, ConditionFieldConfig>;
}

export function PipelineStageManager({ workflowSlug, availablePermissions = [], entityFields = {} }: PipelineStageManagerProps) {
  const { data: workflow, isLoading, isError, refetch } = useWorkflow(workflowSlug);
  const createState = useCreateState(workflowSlug);
  const updateState = useUpdateState(workflowSlug);
  const deleteState = useDeleteState(workflowSlug);
  const createTransition = useCreateTransition(workflowSlug);
  const deleteTransition = useDeleteTransition(workflowSlug);
  const updateTransition = useUpdateTransition(workflowSlug);

  const [stageFormOpen, setStageFormOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<WorkflowState | null>(null);
  const [deletingStage, setDeletingStage] = useState<WorkflowState | null>(null);

  const sortedStates = useMemo(
    () => [...(workflow?.states ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [workflow?.states],
  );

  const nextSortOrder = sortedStates.length > 0 ? Math.max(...sortedStates.map((s) => s.sortOrder)) + 1 : 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !workflow) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Failed to load workflow.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">{workflow.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sortedStates.length} stage{sortedStates.length !== 1 ? 's' : ''} &middot; {workflow.transitions.length} transition{workflow.transitions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditingStage(null); setStageFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Add Stage
        </Button>
      </div>

      {/* Stage list */}
      {sortedStates.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Workflow className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No stages defined yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => { setEditingStage(null); setStageFormOpen(true); }}
          >
            Add your first stage
          </Button>
        </div>
      ) : (
        <div className="space-y-0 border border-border rounded-lg overflow-hidden">
          {sortedStates.map((state, idx) => (
            <div
              key={state.id}
              className={idx < sortedStates.length - 1 ? 'border-b border-border' : ''}
            >
              {/* Stage row */}
              <div className="flex items-center gap-3 px-4 py-3 group hover:bg-accent/30 transition-colors">
                {/* Drag handle */}
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />

                {/* Color dot */}
                <div
                  className="h-3.5 w-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: state.color ?? '#6B7280' }}
                />

                {/* Label + name */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{state.label}</span>
                  {state.name === workflow.initialState && (
                    <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                      Initial
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => { setEditingStage(state); setStageFormOpen(true); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Edit stage"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingStage(state)}
                    disabled={state.name === workflow.initialState}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={state.name === workflow.initialState ? 'Cannot delete initial state' : 'Delete stage'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Transition editor */}
              <StageTransitionEditor
                state={state}
                allStates={sortedStates}
                transitions={workflow.transitions}
                availablePermissions={availablePermissions}
                onAddTransition={(toStateName, name) => {
                  const fromState = workflow.states.find((s) => s.name === state.name);
                  const toState = workflow.states.find((s) => s.name === toStateName);
                  if (fromState && toState) {
                    createTransition.mutate({
                      definitionId: workflow.id,
                      data: { fromStateId: fromState.id, toStateId: toState.id, name },
                    });
                  }
                }}
                onRemoveTransition={(transitionId) => deleteTransition.mutate(transitionId)}
                onUpdateTransitionPermissions={(transitionId, permissions) =>
                  updateTransition.mutate({ transitionId, data: { requiredPermissions: permissions } })
                }
                onUpdateTransitionConditions={(transitionId, conditions) => {
                  const existing = workflow.transitions.find((t) => t.id === transitionId);
                  const metadata = { ...(existing?.metadata as Record<string, unknown> ?? {}), conditions };
                  updateTransition.mutate({ transitionId, data: { metadata } });
                }}
                entityFields={entityFields}
                isPending={createTransition.isPending || deleteTransition.isPending || updateTransition.isPending}
              />
            </div>
          ))}
        </div>
      )}

      {/* Stage add/edit dialog */}
      <StageForm
        open={stageFormOpen}
        onOpenChange={(open) => { setStageFormOpen(open); if (!open) setEditingStage(null); }}
        stage={editingStage}
        nextSortOrder={nextSortOrder}
        isPending={createState.isPending || updateState.isPending}
        onSubmit={(data) => {
          if (editingStage) {
            updateState.mutate(
              { stateId: editingStage.id, data: { label: data.label, color: data.color, sortOrder: data.sortOrder } },
              { onSuccess: () => { setStageFormOpen(false); setEditingStage(null); } },
            );
          } else {
            createState.mutate(
              { definitionId: workflow.id, data },
              { onSuccess: () => { setStageFormOpen(false); } },
            );
          }
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingStage}
        onOpenChange={(open) => { if (!open) setDeletingStage(null); }}
        title="Delete stage"
        description={`This will delete "${deletingStage?.label}" and all its transitions. Records in this stage will need to be reassigned.`}
        confirmLabel="Delete stage"
        isPending={deleteState.isPending}
        onConfirm={() => {
          if (deletingStage) {
            deleteState.mutate(deletingStage.id, { onSuccess: () => setDeletingStage(null) });
          }
        }}
      />
    </div>
  );
}
