import { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@packages/ui';
import { useWorkflow, useTransitionHistory } from '../hooks';
import type { WorkflowState, TransitionHistoryEntry } from '../types';

interface PipelineProgressBarProps {
  workflowSlug: string;
  entityType: string;
  entityId: string;
  currentState: string;
}

interface StageInfo {
  state: WorkflowState;
  status: 'completed' | 'current' | 'pending';
  /** The history entry when this state was entered (toState = this state) */
  entry: TransitionHistoryEntry | null;
}

/**
 * Horizontal pipeline progress bar showing workflow stages.
 * Completed stages are derived from transition history (not sortOrder).
 */
export function PipelineProgressBar({ workflowSlug, entityType, entityId, currentState }: PipelineProgressBarProps) {
  const { data: workflow } = useWorkflow(workflowSlug);
  const { data: history } = useTransitionHistory(entityType, entityId);

  const stages = useMemo<StageInfo[]>(() => {
    if (!workflow?.states) return [];

    // Sort states by sortOrder for display
    const sortedStates = [...workflow.states].sort((a, b) => a.sortOrder - b.sortOrder);

    // Build a map of state → most recent history entry where this state was entered
    const stateEntryMap = new Map<string, TransitionHistoryEntry>();
    if (history) {
      // History is newest-first, so iterate in reverse to get the first time each state was entered
      // Then overwrite with later entries (most recent entry wins)
      for (const entry of history) {
        stateEntryMap.set(entry.toState, entry);
      }
    }

    // Determine visited states from history
    const visitedStates = new Set<string>();
    if (history) {
      for (const entry of history) {
        visitedStates.add(entry.toState);
      }
    }
    // The initial state is visited if it's the current state or appears in history
    if (currentState) visitedStates.add(currentState);

    return sortedStates
      .filter((s) => !isTerminalExitState(s.name, currentState, sortedStates))
      .map((state) => ({
        state,
        status: state.name === currentState ? 'current'
          : visitedStates.has(state.name) ? 'completed'
          : 'pending',
        entry: stateEntryMap.get(state.name) ?? null,
      }));
  }, [workflow, history, currentState]);

  if (!workflow || stages.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-start overflow-x-auto pb-2">
        {stages.map((stage, idx) => (
          <div key={stage.state.id} className="flex items-start shrink-0">
            {/* Stage circle + label */}
            <div className="flex flex-col items-center" style={{ minWidth: '80px' }}>
              {/* Circle */}
              <div
                className={cn(
                  'rounded-full border-2 flex items-center justify-center transition-all',
                  stage.status === 'completed' && 'h-4 w-4 border-primary bg-primary',
                  stage.status === 'current' && 'h-5 w-5 border-primary bg-primary ring-4 ring-primary/20',
                  stage.status === 'pending' && 'h-4 w-4 border-muted-foreground/30 bg-transparent',
                )}
              />

              {/* Label */}
              <span
                className={cn(
                  'text-[11px] mt-1.5 text-center leading-tight max-w-[80px]',
                  stage.status === 'current' && 'font-semibold text-foreground',
                  stage.status === 'completed' && 'text-muted-foreground',
                  stage.status === 'pending' && 'text-muted-foreground/50',
                )}
              >
                {stage.state.label}
              </span>

              {/* Date + actor (only for completed/current with history) */}
              {stage.entry && (stage.status === 'completed' || stage.status === 'current') && (
                <div className="text-center mt-0.5">
                  <span className="text-[9px] text-muted-foreground block">
                    {format(new Date(stage.entry.createdAt), 'MMM d, h:mm a')}
                  </span>
                  {stage.entry.actorName && (
                    <span className="text-[9px] text-muted-foreground/70 block truncate max-w-[80px]">
                      {stage.entry.actorName}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Connector line */}
            {idx < stages.length - 1 && (
              <div
                className={cn(
                  'h-[2px] mt-2 shrink-0',
                  stage.status === 'completed' || stage.status === 'current'
                    ? 'bg-primary'
                    : 'bg-muted-foreground/20',
                )}
                style={{ width: '32px' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Terminal exit states (rejected, withdrawn, etc.) should only show
 * if the entity is currently in that state. Otherwise they clutter the bar.
 */
function isTerminalExitState(stateName: string, currentState: string, allStates: WorkflowState[]): boolean {
  if (stateName === currentState) return false; // Always show if current
  // Heuristic: states with no outgoing transitions in the workflow are terminal
  // For simplicity, check common terminal state names
  const terminalNames = new Set(['rejected', 'withdrawn', 'archived', 'cancelled', 'closed', 'lost']);
  return terminalNames.has(stateName);
}
