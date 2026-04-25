import type { WorkflowDefinition, WorkflowTransition, WorkflowState } from '../types';

export interface ClientAvailableTransition {
  transition: WorkflowTransition;
  toState: WorkflowState;
  /** Whether this is a "forward" transition (toState.sortOrder > currentState.sortOrder) */
  isForward: boolean;
}

/**
 * Derives available transitions from a workflow definition for a given current state.
 * Mirrors backend WorkflowEngineService.getAvailableTransitions but runs client-side.
 */
export function getAvailableTransitions(
  workflow: WorkflowDefinition,
  currentStateName: string,
): ClientAvailableTransition[] {
  const currentState = workflow.states.find((s) => s.name === currentStateName);
  if (!currentState) return [];

  return workflow.transitions
    .filter((t) => t.fromStateName === currentStateName)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => {
      const toState = workflow.states.find((s) => s.name === t.toStateName);
      if (!toState) return null;
      return {
        transition: t,
        toState,
        isForward: toState.sortOrder > currentState.sortOrder,
      };
    })
    .filter((t): t is ClientAvailableTransition => t !== null);
}
