import { useState, useMemo, useCallback } from 'react';
import { KanbanBoard, toast } from '@packages/ui';
import type { KanbanColumnDef, KanbanCardData } from '@packages/ui';
import { useWorkflow, useEntityTransition } from '../hooks';
import { getAvailableTransitions } from '../helpers/getAvailableTransitions';
import type { WorkflowDefinition, WorkflowState } from '../types';
import { TransitionConfirmDialog } from './TransitionConfirmDialog';

interface WorkflowKanbanBoardProps {
  /** Workflow definition slug (e.g., 'application-stage') */
  workflowSlug: string;
  /** Entity slug for transition API (e.g., 'applications') */
  entitySlug: string;
  /** Entity type for query invalidation (e.g., 'applications') */
  entityType: string;
  /** Singular name for toast messages (e.g., 'Application') */
  singularName: string;
  /** The workflow field key on the entity (e.g., 'stage') */
  fieldName: string;
  /** Entity records — each must have `id` and the workflow field */
  records: Record<string, unknown>[];
  /** Custom card renderer — receives the full record */
  renderCard: (record: Record<string, unknown>) => React.ReactNode;
  /** Loading state (records still fetching) */
  isLoading?: boolean;
  /** Called after a successful transition */
  onTransitionSuccess?: () => void;
}

interface PendingTransition {
  recordId: string;
  toStateName: string;
  transitionName: string;
  toStateLabel: string;
  reasonOptions?: string[] | null;
  reasonRequired?: boolean;
  commentRequired?: boolean;
}

function formatLabel(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

/**
 * Terminal exit states (rejected, withdrawn, etc.) are still shown as columns
 * but only when there are cards in them. This avoids empty terminal columns
 * cluttering the board.
 */
const TERMINAL_NAMES = new Set(['rejected', 'withdrawn', 'archived', 'cancelled', 'closed', 'lost']);

export function WorkflowKanbanBoard({
  workflowSlug,
  entitySlug,
  entityType,
  singularName,
  fieldName,
  records,
  renderCard,
  isLoading,
  onTransitionSuccess,
}: WorkflowKanbanBoardProps) {
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  const { data: workflow, isLoading: workflowLoading } = useWorkflow(workflowSlug);

  const transitionMutation = useEntityTransition(entitySlug, entityType, singularName, {
    onSuccess: () => onTransitionSuccess?.(),
  });

  // Build a set of states that have records for terminal column filtering
  const occupiedStates = useMemo(() => {
    const set = new Set<string>();
    for (const record of records) {
      const state = record[fieldName] as string;
      if (state) set.add(state);
    }
    return set;
  }, [records, fieldName]);

  // Map workflow states → kanban columns
  const columns = useMemo<KanbanColumnDef[]>(() => {
    if (!workflow?.states) return [];
    return [...workflow.states]
      .sort((a: WorkflowState, b: WorkflowState) => a.sortOrder - b.sortOrder)
      .filter((state: WorkflowState) => {
        // Always show non-terminal states; show terminal only if occupied
        if (TERMINAL_NAMES.has(state.name)) return occupiedStates.has(state.name);
        return true;
      })
      .map((state: WorkflowState) => ({
        id: state.name,
        label: state.label,
        color: state.color ?? undefined,
      }));
  }, [workflow, occupiedStates]);

  // Map records → kanban cards
  const cards = useMemo<KanbanCardData[]>(() => {
    return records.map((record: Record<string, unknown>) => ({
      ...record,
      id: record.id as string,
      columnId: (record[fieldName] as string) ?? '',
    }));
  }, [records, fieldName]);

  // Record lookup for handlers
  const recordMap = useMemo(
    () => new Map(records.map((r: Record<string, unknown>) => [r.id as string, r])),
    [records],
  );

  const handleCardMove = useCallback(
    (cardId: string, toColumnId: string) => {
      if (!workflow) return;

      const record = recordMap.get(cardId);
      if (!record) return;

      const currentState = record[fieldName] as string;
      if (currentState === toColumnId) return;

      const available = getAvailableTransitions(workflow, currentState);
      const match = available.find((t) => t.toState.name === toColumnId);

      if (!match) {
        toast.error(
          `Cannot move from ${formatLabel(currentState)} to ${formatLabel(toColumnId)}`,
        );
        // Board auto-reverts: external cards unchanged triggers sync in KanbanBoard
        setBoardKey((k: number) => k + 1);
        return;
      }

      const { transition, toState } = match;

      // If transition requires reason/comment, show dialog
      if (
        transition.reasonRequired ||
        transition.commentRequired ||
        (transition.reasonOptions && transition.reasonOptions.length > 0)
      ) {
        setPendingTransition({
          recordId: cardId,
          toStateName: toState.name,
          transitionName: `Move to ${toState.label}`,
          toStateLabel: toState.label,
          reasonOptions: transition.reasonOptions,
          reasonRequired: transition.reasonRequired,
          commentRequired: transition.commentRequired,
        });
        return;
      }

      // Execute transition directly
      transitionMutation.mutate({
        id: cardId,
        fieldKey: fieldName,
        to: toColumnId,
      });
    },
    [workflow, recordMap, fieldName, transitionMutation],
  );

  const handleTransitionConfirm = useCallback(
    ({ reason, comment }: { reason?: string; comment?: string }) => {
      if (!pendingTransition) return;
      transitionMutation.mutate(
        {
          id: pendingTransition.recordId,
          fieldKey: fieldName,
          to: pendingTransition.toStateName,
          reason,
          comment,
        },
        { onSuccess: () => setPendingTransition(null) },
      );
    },
    [pendingTransition, fieldName, transitionMutation],
  );

  const handleDialogClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setPendingTransition(null);
        setBoardKey((k: number) => k + 1); // force board to revert optimistic state
      }
    },
    [],
  );

  return (
    <>
      <KanbanBoard
        key={boardKey}
        columns={columns}
        cards={cards}
        onCardMove={handleCardMove}
        renderCard={(card: KanbanCardData) => {
          const record = recordMap.get(card.id);
          if (!record) return null;
          return renderCard(record);
        }}
        isLoading={isLoading || workflowLoading}
      />

      <TransitionConfirmDialog
        open={!!pendingTransition}
        onOpenChange={handleDialogClose}
        transitionName={pendingTransition?.transitionName ?? ''}
        toStateLabel={pendingTransition?.toStateLabel ?? ''}
        isPending={transitionMutation.isPending}
        reasonOptions={pendingTransition?.reasonOptions}
        reasonRequired={pendingTransition?.reasonRequired}
        commentRequired={pendingTransition?.commentRequired}
        onConfirm={handleTransitionConfirm}
      />
    </>
  );
}
