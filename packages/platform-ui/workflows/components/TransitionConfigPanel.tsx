import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@packages/ui';
import { useUpdateTransition, useDeleteTransition } from '../hooks';
import type { WorkflowTransition } from '../types';

interface TransitionConfigPanelProps {
  transition: WorkflowTransition;
  slug: string;
  onClose: () => void;
}

export function TransitionConfigPanel({ transition, slug, onClose }: TransitionConfigPanelProps) {
  const [name, setName] = useState(transition.name);
  const [permissions, setPermissions] = useState(transition.requiredPermissions.join(', '));
  const [guards, setGuards] = useState(transition.guardNames.join(', '));

  const updateMutation = useUpdateTransition(slug);
  const deleteMutation = useDeleteTransition(slug);

  useEffect(() => {
    setName(transition.name);
    setPermissions(transition.requiredPermissions.join(', '));
    setGuards(transition.guardNames.join(', '));
  }, [transition]);

  function handleSave() {
    const requiredPermissions = permissions
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const guardNames = guards
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    updateMutation.mutate({
      transitionId: transition.id,
      data: {
        name,
        requiredPermissions: requiredPermissions.length > 0 ? requiredPermissions : null,
        guardNames: guardNames.length > 0 ? guardNames : null,
      },
    });
  }

  function handleDelete() {
    if (confirm(`Delete transition "${name}"?`)) {
      deleteMutation.mutate(transition.id, { onSuccess: onClose });
    }
  }

  const hasChanges =
    name !== transition.name ||
    permissions !== transition.requiredPermissions.join(', ') ||
    guards !== transition.guardNames.join(', ');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Transition</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium">{transition.fromStateName}</span>
        {' → '}
        <span className="font-medium">{transition.toStateName}</span>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Name (action label)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., Approve, Start, Cancel"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Required permissions</label>
          <input
            type="text"
            value={permissions}
            onChange={(e) => setPermissions(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Comma-separated, e.g., tasks.transition"
          />
          <p className="text-[10px] text-muted-foreground">Comma-separated permission names</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Guards</label>
          <input
            type="text"
            value={guards}
            onChange={(e) => setGuards(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Comma-separated, e.g., not-same-actor"
          />
          <p className="text-[10px] text-muted-foreground">Comma-separated guard function names</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
