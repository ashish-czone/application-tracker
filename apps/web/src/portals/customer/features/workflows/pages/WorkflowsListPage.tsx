import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Workflow, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Badge, Button,
  Dialog, DialogContent, ConfirmDialog,
} from '@packages/ui';
import { useWorkflows, useDeleteWorkflow } from '../hooks';
import { AddWorkflowForm } from '../components/AddWorkflowForm';
import type { WorkflowDefinition } from '../types';

export default function WorkflowsListPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowDefinition | null>(null);
  const navigate = useNavigate();

  const { data: workflows, isLoading } = useWorkflows();
  const deleteMutation = useDeleteWorkflow({ onSuccess: () => setDeletingWorkflow(null) });

  const sortedWorkflows = useMemo(() => {
    if (!workflows) return [];
    return [...workflows].sort((a, b) => a.name.localeCompare(b.name));
  }, [workflows]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Workflows</h1>
        <p className="text-sm text-muted-foreground">Manage workflow definitions and state machines</p>
      </div>

      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : sortedWorkflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-sm font-medium text-foreground mb-1">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first workflow to define state machines for your entities.</p>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Workflow
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sortedWorkflows.map((wf) => (
            <div
              key={wf.id}
              className="flex items-center justify-between rounded-lg border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/workflows/${wf.slug}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/workflows/${wf.slug}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{wf.name}</span>
                  <Badge variant={wf.isActive ? 'default' : 'secondary'}>
                    {wf.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Entity: <code className="text-xs bg-muted px-1 py-0.5 rounded">{wf.entityType}</code></span>
                  <span>Field: <code className="text-xs bg-muted px-1 py-0.5 rounded">{wf.fieldName}</code></span>
                  <span>Initial: <code className="text-xs bg-muted px-1 py-0.5 rounded">{wf.initialState}</code></span>
                  <span>{wf.states.length} states</span>
                  <span>{wf.transitions.length} transitions</span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => navigate(`/workflows/${wf.slug}`)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label={`Edit ${wf.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingWorkflow(wf)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={`Delete ${wf.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Workflow Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <AddWorkflowForm onClose={() => setAddModalOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingWorkflow}
        onOpenChange={(open) => !open && setDeletingWorkflow(null)}
        title="Delete workflow"
        description={
          deletingWorkflow
            ? `This will delete the "${deletingWorkflow.name}" workflow and all its states and transitions.`
            : ''
        }
        confirmLabel="Delete workflow"
        isPending={deleteMutation.isPending}
        onConfirm={() => deletingWorkflow && deleteMutation.mutate(deletingWorkflow.id)}
      />
    </div>
  );
}
