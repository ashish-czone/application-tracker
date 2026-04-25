import { useState, useEffect } from 'react';
import { X, Trash2, Lock } from 'lucide-react';
import { Button, Badge } from '@packages/ui';
import { useUpdateState, useDeleteState } from '../hooks';
import type { WorkflowState } from '../types';

interface StateConfigPanelProps {
  state: WorkflowState;
  isInitial: boolean;
  slug: string;
  onClose: () => void;
}

export function StateConfigPanel({ state, isInitial, slug, onClose }: StateConfigPanelProps) {
  const [name, setName] = useState(state.name);
  const [label, setLabel] = useState(state.label);
  const [color, setColor] = useState(state.color ?? '#6B7280');
  const [sortOrder, setSortOrder] = useState(state.sortOrder);

  const updateMutation = useUpdateState(slug);
  const deleteMutation = useDeleteState(slug);

  useEffect(() => {
    setName(state.name);
    setLabel(state.label);
    setColor(state.color ?? '#6B7280');
    setSortOrder(state.sortOrder);
  }, [state]);

  function handleSave() {
    updateMutation.mutate({
      stateId: state.id,
      data: { name, label, color, sortOrder },
    });
  }

  function handleDelete() {
    if (confirm(`Delete state "${label}"? This will also remove all connected transitions.`)) {
      deleteMutation.mutate(state.id, { onSuccess: onClose });
    }
  }

  const hasChanges =
    name !== state.name ||
    label !== state.label ||
    color !== (state.color ?? '#6B7280') ||
    sortOrder !== state.sortOrder;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">State</h3>
          {isInitial && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">Initial</Badge>
          )}
          {state.isSystem && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1" title="Code-load-bearing — name and existence are locked">
              <Lock className="h-2.5 w-2.5" />
              System
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Name (identifier)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={state.isSystem}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
          {state.isSystem && (
            <p className="text-[11px] text-muted-foreground">
              This state is referenced by code. Renaming would break domain logic.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Label (display)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 rounded border border-input cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Sort order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            min={0}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleteMutation.isPending || isInitial || state.isSystem}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {isInitial
            ? 'Cannot delete initial'
            : state.isSystem
              ? 'Cannot delete system'
              : 'Delete'}
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
