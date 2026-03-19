import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Plus, AlertTriangle, XCircle } from 'lucide-react';
import {
  Badge, Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Form, FormInput,
} from '@packages/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useWorkflow, useCreateState } from '../hooks';
import { WorkflowCanvas } from '../components/WorkflowCanvas';
import { validateWorkflow } from '../components/workflow-validation';

const addStateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).regex(/^[a-z0-9_]+$/, 'Lowercase alphanumeric + underscores'),
  label: z.string().min(1, 'Label is required').max(200),
  color: z.string().max(50).optional(),
});

type AddStateFormValues = z.infer<typeof addStateSchema>;

export default function WorkflowEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [addStateOpen, setAddStateOpen] = useState(false);

  const { data: workflow, isLoading, isError } = useWorkflow(slug!);
  const createStateMutation = useCreateState(slug!);

  const form = useForm<AddStateFormValues>({
    resolver: zodResolver(addStateSchema),
    defaultValues: { name: '', label: '', color: '#6B7280' },
  });

  function onAddState(data: AddStateFormValues) {
    if (!workflow) return;
    createStateMutation.mutate(
      { definitionId: workflow.id, data: { name: data.name, label: data.label, color: data.color } },
      {
        onSuccess: () => {
          setAddStateOpen(false);
          form.reset();
        },
      },
    );
  }

  const warnings = useMemo(
    () => (workflow ? validateWorkflow(workflow) : []),
    [workflow],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-[600px] animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError || !workflow) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Workflow not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/workflows')}>
          Back to Workflows
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/workflows')}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{workflow.name}</h1>
              <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                {workflow.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {workflow.entityType}.{workflow.fieldName} — {workflow.states.length} states, {workflow.transitions.length} transitions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddStateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add State
          </Button>
        </div>
      </div>

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <div className="mb-3 space-y-1.5 shrink-0">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                w.severity === 'error'
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/20'
              }`}
            >
              {w.severity === 'error' ? (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 rounded-lg border bg-card overflow-hidden">
        <WorkflowCanvas workflow={workflow} slug={slug!} />
      </div>

      {/* Add State Modal */}
      <Dialog open={addStateOpen} onOpenChange={setAddStateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add State</DialogTitle>
            <DialogDescription>Add a new state to this workflow</DialogDescription>
          </DialogHeader>
          <Form form={form} onSubmit={form.handleSubmit(onAddState)} className="space-y-4">
            <FormInput
              name="name"
              label="Name (identifier)"
              placeholder="e.g., in_review"
              description="Lowercase with underscores"
            />
            <FormInput
              name="label"
              label="Label (display)"
              placeholder="e.g., In Review"
            />
            <FormInput
              name="color"
              label="Color"
              type="color"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddStateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createStateMutation.isPending}>
                {createStateMutation.isPending ? 'Adding...' : 'Add State'}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
