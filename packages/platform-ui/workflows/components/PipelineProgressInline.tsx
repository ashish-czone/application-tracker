import { useMemo } from 'react';
import { cn } from '@packages/ui';
import { useWorkflows } from '../hooks';
import type { WorkflowState } from '../types';

interface PipelineProgressInlineProps {
  value: unknown;
  row: Record<string, unknown>;
  entityType: string;
}

/**
 * Compact inline progress dots for list view table cells.
 * Shows workflow stages as small circles: filled for completed/current, hollow for pending.
 * Derives position from sortOrder — no history fetch (lightweight for N rows).
 */
export function PipelineProgressInline({ value, entityType }: PipelineProgressInlineProps) {
  const { data: allWorkflows } = useWorkflows();

  const currentStateName = typeof value === 'string' ? value : null;

  const stages = useMemo(() => {
    if (!allWorkflows || !currentStateName) return [];

    const workflow = allWorkflows.find((w) => w.entityType === entityType && w.isActive);
    if (!workflow) return [];

    const sorted = [...workflow.states].sort((a, b) => a.sortOrder - b.sortOrder);
    const filtered = sorted.filter((s) => !isTerminalExitState(s.name, currentStateName));
    const currentIdx = filtered.findIndex((s) => s.name === currentStateName);

    return filtered.map((state, idx) => ({
      state,
      status: idx < currentIdx ? 'completed' as const
        : idx === currentIdx ? 'current' as const
        : 'pending' as const,
    }));
  }, [allWorkflows, entityType, currentStateName]);

  if (stages.length === 0) {
    return <span className="text-muted-foreground text-sm">{currentStateName ?? '-'}</span>;
  }

  const currentState = stages.find((s) => s.status === 'current');

  return (
    <div className="flex items-center gap-1" title={currentState?.state.label}>
      {stages.map((stage) => (
        <div
          key={stage.state.id}
          className={cn(
            'rounded-full transition-all',
            stage.status === 'completed' && 'h-2 w-2 bg-primary',
            stage.status === 'current' && 'h-2.5 w-2.5 bg-primary ring-2 ring-primary/20',
            stage.status === 'pending' && 'h-2 w-2 border border-muted-foreground/30 bg-transparent',
          )}
        />
      ))}
    </div>
  );
}

function isTerminalExitState(stateName: string, currentState: string): boolean {
  if (stateName === currentState) return false;
  const terminalNames = new Set(['rejected', 'withdrawn', 'archived', 'cancelled', 'closed', 'lost']);
  return terminalNames.has(stateName);
}
