import type { WorkflowDefinition } from '../types';

export interface ValidationWarning {
  type: 'orphaned' | 'unreachable' | 'dead-end' | 'no-transitions';
  severity: 'warning' | 'error';
  message: string;
  stateNames?: string[];
}

export function validateWorkflow(workflow: WorkflowDefinition): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const { states, transitions, initialState } = workflow;

  if (states.length === 0) return warnings;

  // Build adjacency sets
  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();

  for (const t of transitions) {
    hasOutgoing.add(t.fromStateName);
    hasIncoming.add(t.toStateName);
  }

  // No transitions at all
  if (transitions.length === 0 && states.length > 1) {
    warnings.push({
      type: 'no-transitions',
      severity: 'error',
      message: 'No transitions defined. Add transitions to connect states.',
    });
    return warnings;
  }

  // Orphaned states: no incoming AND no outgoing (excluding initial state which naturally has no incoming)
  const orphaned = states.filter(
    (s) => s.name !== initialState && !hasIncoming.has(s.name) && !hasOutgoing.has(s.name),
  );
  if (orphaned.length > 0) {
    warnings.push({
      type: 'orphaned',
      severity: 'error',
      message: `Orphaned state${orphaned.length > 1 ? 's' : ''}: ${orphaned.map((s) => s.label).join(', ')} — no connections at all`,
      stateNames: orphaned.map((s) => s.name),
    });
  }

  // Unreachable states: no incoming transitions (excluding initial state)
  const unreachable = states.filter(
    (s) =>
      s.name !== initialState &&
      !hasIncoming.has(s.name) &&
      hasOutgoing.has(s.name), // has outgoing but no incoming — can't reach it
  );
  if (unreachable.length > 0) {
    warnings.push({
      type: 'unreachable',
      severity: 'warning',
      message: `Unreachable state${unreachable.length > 1 ? 's' : ''}: ${unreachable.map((s) => s.label).join(', ')} — no incoming transitions`,
      stateNames: unreachable.map((s) => s.name),
    });
  }

  // Dead-end states: has incoming but no outgoing (these are terminal states — might be intentional like "done" or "cancelled")
  // Only warn if the initial state has no outgoing
  if (!hasOutgoing.has(initialState)) {
    warnings.push({
      type: 'dead-end',
      severity: 'error',
      message: `Initial state "${states.find((s) => s.name === initialState)?.label ?? initialState}" has no outgoing transitions`,
      stateNames: [initialState],
    });
  }

  return warnings;
}
