import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { cn, Button, Badge } from '@packages/ui';
import type { WorkflowState, WorkflowTransition } from '../types';

interface StageTransitionEditorProps {
  state: WorkflowState;
  allStates: WorkflowState[];
  transitions: WorkflowTransition[];
  availablePermissions: string[];
  onAddTransition: (toStateName: string, name: string) => void;
  onRemoveTransition: (transitionId: string) => void;
  onUpdateTransitionPermissions: (transitionId: string, permissions: string[]) => void;
  isPending: boolean;
}

export function StageTransitionEditor({
  state,
  allStates,
  transitions,
  availablePermissions,
  onAddTransition,
  onRemoveTransition,
  onUpdateTransitionPermissions,
  isPending,
}: StageTransitionEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);

  const outgoing = useMemo(
    () => transitions.filter((t) => t.fromStateName === state.name),
    [transitions, state.name],
  );

  const outgoingTargetNames = useMemo(
    () => new Set(outgoing.map((t) => t.toStateName)),
    [outgoing],
  );

  const availableTargets = useMemo(
    () => allStates.filter((s) => s.name !== state.name && !outgoingTargetNames.has(s.name)),
    [allStates, state.name, outgoingTargetNames],
  );

  return (
    <div className="border-t border-border/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {outgoing.length} transition{outgoing.length !== 1 ? 's' : ''}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {/* Existing transitions */}
          {outgoing.map((t) => {
            const targetState = allStates.find((s) => s.name === t.toStateName);
            return (
              <div key={t.id} className="flex items-center gap-2 group">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: targetState?.color ?? '#6B7280' }}
                />
                <span className="text-sm flex-1 truncate">{targetState?.label ?? t.toStateName}</span>

                {/* Permission badges */}
                {t.requiredPermissions.length > 0 && (
                  <div className="flex gap-1">
                    {t.requiredPermissions.map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">
                        {p}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Permission edit toggle */}
                <button
                  type="button"
                  onClick={() => setShowPermissions(showPermissions === t.id ? null : t.id)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit permissions"
                >
                  <Shield className="h-3 w-3" />
                </button>

                {/* Remove transition */}
                <button
                  type="button"
                  onClick={() => onRemoveTransition(t.id)}
                  disabled={isPending}
                  className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remove
                </button>

                {/* Inline permissions editor */}
                {showPermissions === t.id && (
                  <div className="absolute right-0 mt-8 z-10 bg-popover border border-border rounded-md shadow-md p-3 min-w-[200px]">
                    <p className="text-xs font-medium mb-2">Required Permissions</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {availablePermissions.map((perm) => (
                        <label key={perm} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={t.requiredPermissions.includes(perm)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...t.requiredPermissions, perm]
                                : t.requiredPermissions.filter((p) => p !== perm);
                              onUpdateTransitionPermissions(t.id, updated);
                            }}
                            className="rounded border-input"
                          />
                          {perm}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add transition */}
          {availableTargets.length > 0 && (
            <div className="pt-1">
              <select
                onChange={(e) => {
                  const targetName = e.target.value;
                  if (!targetName) return;
                  const targetState = allStates.find((s) => s.name === targetName);
                  onAddTransition(targetName, `${state.name}_to_${targetName}`);
                  e.target.value = '';
                }}
                className="w-full text-xs rounded-md border border-dashed border-border bg-transparent px-2 py-1.5 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={isPending}
                defaultValue=""
              >
                <option value="" disabled>+ Add transition to...</option>
                {availableTargets.map((s) => (
                  <option key={s.name} value={s.name}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
