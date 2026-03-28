import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Shield, Filter } from 'lucide-react';
import { cn, Badge } from '@packages/ui';
import { ConditionBuilder, type Condition, type ConditionFieldConfig } from '../../conditions';
import type { WorkflowState, WorkflowTransition } from '../types';

interface StageTransitionEditorProps {
  state: WorkflowState;
  allStates: WorkflowState[];
  transitions: WorkflowTransition[];
  availablePermissions: string[];
  entityFields: Record<string, ConditionFieldConfig>;
  onAddTransition: (toStateName: string, name: string) => void;
  onRemoveTransition: (transitionId: string) => void;
  onUpdateTransitionPermissions: (transitionId: string, permissions: string[]) => void;
  onUpdateTransitionConditions: (transitionId: string, conditions: Condition[]) => void;
  isPending: boolean;
}

function getTransitionConditions(transition: WorkflowTransition): Condition[] {
  const meta = transition.metadata as Record<string, unknown> | null;
  if (!meta?.conditions) return [];
  return meta.conditions as Condition[];
}

export function StageTransitionEditor({
  state,
  allStates,
  transitions,
  availablePermissions,
  entityFields,
  onAddTransition,
  onRemoveTransition,
  onUpdateTransitionPermissions,
  onUpdateTransitionConditions,
  isPending,
}: StageTransitionEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<{ id: string; type: 'permissions' | 'conditions' } | null>(null);

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

  function togglePanel(transitionId: string, type: 'permissions' | 'conditions') {
    if (activePanel?.id === transitionId && activePanel.type === type) {
      setActivePanel(null);
    } else {
      setActivePanel({ id: transitionId, type });
    }
  }

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
        <div className="px-4 pb-3 space-y-1">
          {/* Existing transitions */}
          {outgoing.map((t) => {
            const targetState = allStates.find((s) => s.name === t.toStateName);
            const conditions = getTransitionConditions(t);
            const hasConditions = conditions.length > 0;
            const hasPermissions = t.requiredPermissions.length > 0;

            return (
              <div key={t.id}>
                {/* Transition row */}
                <div className="flex items-center gap-2 group py-1">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: targetState?.color ?? '#6B7280' }}
                  />
                  <span className="text-sm flex-1 truncate">{targetState?.label ?? t.toStateName}</span>

                  {/* Indicators */}
                  {hasPermissions && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {t.requiredPermissions.length} perm{t.requiredPermissions.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {hasConditions && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {conditions.length} condition{conditions.length !== 1 ? 's' : ''}
                    </Badge>
                  )}

                  {/* Action buttons */}
                  <button
                    type="button"
                    onClick={() => togglePanel(t.id, 'permissions')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      activePanel?.id === t.id && activePanel.type === 'permissions'
                        ? 'text-foreground bg-accent'
                        : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100',
                    )}
                    title="Edit permissions"
                  >
                    <Shield className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel(t.id, 'conditions')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      activePanel?.id === t.id && activePanel.type === 'conditions'
                        ? 'text-foreground bg-accent'
                        : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100',
                    )}
                    title="Edit conditions"
                  >
                    <Filter className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveTransition(t.id)}
                    disabled={isPending}
                    className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Remove
                  </button>
                </div>

                {/* Permissions panel */}
                {activePanel?.id === t.id && activePanel.type === 'permissions' && (
                  <div className="ml-5 mt-1 mb-2 p-3 border border-border rounded-md bg-accent/30">
                    <p className="text-xs font-medium mb-2">Required Permissions</p>
                    {availablePermissions.length > 0 ? (
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
                    ) : (
                      <p className="text-xs text-muted-foreground">No permissions available.</p>
                    )}
                  </div>
                )}

                {/* Conditions panel */}
                {activePanel?.id === t.id && activePanel.type === 'conditions' && (
                  <div className="ml-5 mt-1 mb-2 p-3 border border-border rounded-md bg-accent/30">
                    <p className="text-xs font-medium mb-2">Conditions (all must be met)</p>
                    <ConditionBuilder
                      conditions={conditions}
                      onChange={(updated) => onUpdateTransitionConditions(t.id, updated)}
                      fields={entityFields}
                    />
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
