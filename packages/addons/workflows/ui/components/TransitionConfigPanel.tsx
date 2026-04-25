import { useState, useEffect } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { Button } from '@packages/ui';
import { ConditionBuilder, type Condition, type ConditionFieldConfig } from '@packages/conditions-ui';
import { useUpdateTransition, useDeleteTransition } from '../hooks';
import type { WorkflowTransition } from '../types';

interface TransitionConfigPanelProps {
  transition: WorkflowTransition;
  slug: string;
  onClose: () => void;
  entityFields?: Record<string, ConditionFieldConfig>;
}

function getTransitionConditions(transition: WorkflowTransition): Condition[] {
  const meta = transition.metadata as Record<string, unknown> | null;
  if (!meta?.conditions) return [];
  return meta.conditions as Condition[];
}

export function TransitionConfigPanel({ transition, slug, onClose, entityFields = {} }: TransitionConfigPanelProps) {
  const [name, setName] = useState(transition.name);
  const [permissions, setPermissions] = useState(transition.requiredPermissions.join(', '));
  const [guards, setGuards] = useState(transition.guardNames.join(', '));
  const [conditions, setConditions] = useState<Condition[]>(getTransitionConditions(transition));
  const [reasonOptions, setReasonOptions] = useState<string[]>(transition.reasonOptions ?? []);
  const [reasonRequired, setReasonRequired] = useState(transition.reasonRequired);
  const [commentRequired, setCommentRequired] = useState(transition.commentRequired);
  const [newReasonOption, setNewReasonOption] = useState('');

  const updateMutation = useUpdateTransition(slug);
  const deleteMutation = useDeleteTransition(slug);

  useEffect(() => {
    setName(transition.name);
    setPermissions(transition.requiredPermissions.join(', '));
    setGuards(transition.guardNames.join(', '));
    setConditions(getTransitionConditions(transition));
    setReasonOptions(transition.reasonOptions ?? []);
    setReasonRequired(transition.reasonRequired);
    setCommentRequired(transition.commentRequired);
    setNewReasonOption('');
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

    const existingMeta = (transition.metadata as Record<string, unknown> | null) ?? {};
    const metadata = { ...existingMeta, conditions: conditions.length > 0 ? conditions : undefined };

    updateMutation.mutate({
      transitionId: transition.id,
      data: {
        name,
        requiredPermissions: requiredPermissions.length > 0 ? requiredPermissions : null,
        guardNames: guardNames.length > 0 ? guardNames : null,
        reasonOptions: reasonOptions.length > 0 ? reasonOptions : null,
        reasonRequired,
        commentRequired,
        metadata,
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
    guards !== transition.guardNames.join(', ') ||
    JSON.stringify(conditions) !== JSON.stringify(getTransitionConditions(transition)) ||
    JSON.stringify(reasonOptions) !== JSON.stringify(transition.reasonOptions ?? []) ||
    reasonRequired !== transition.reasonRequired ||
    commentRequired !== transition.commentRequired;

  function addReasonOption() {
    const trimmed = newReasonOption.trim();
    if (trimmed && !reasonOptions.includes(trimmed)) {
      setReasonOptions([...reasonOptions, trimmed]);
      setNewReasonOption('');
    }
  }

  function removeReasonOption(option: string) {
    setReasonOptions(reasonOptions.filter((o) => o !== option));
  }

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

        {/* Transition Reason */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Reason options</label>
          <div className="flex flex-wrap gap-1.5">
            {reasonOptions.map((option) => (
              <span
                key={option}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground"
              >
                {option}
                <button
                  type="button"
                  onClick={() => removeReasonOption(option)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newReasonOption}
              onChange={(e) => setNewReasonOption(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addReasonOption())}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Add a reason option..."
            />
            <Button size="sm" variant="outline" onClick={addReasonOption} disabled={!newReasonOption.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Options shown when this transition is triggered</p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={reasonRequired}
              onChange={(e) => setReasonRequired(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-muted-foreground">Reason required</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={commentRequired}
              onChange={(e) => setCommentRequired(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-muted-foreground">Comment required</span>
          </label>
        </div>

        {/* Conditions */}
        {Object.keys(entityFields).length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Conditions (all must be met)</label>
            <ConditionBuilder
              conditions={conditions}
              onChange={setConditions}
              fields={entityFields}
            />
          </div>
        )}
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
