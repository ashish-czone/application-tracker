/**
 * Preflight of a proposed transition: legality check + missing permissions.
 * Per-entity guards (warnings + blockers) are computed by per-entity services
 * and merged client-side or via per-entity preview endpoints.
 */
export interface TransitionPreflight {
  transitionId: string | null;
  warnings: string[];
  blockers: string[];
  missingPermissions: string[];
}

// Cached workflow definition with states and transitions for in-memory lookups
export interface CachedWorkflowDefinition {
  id: string;
  slug: string;
  name: string;
  entityType: string;
  fieldName: string;
  initialState: string;
  isActive: boolean;
  discriminatorKey: string | null;
  discriminatorValue: string | null;
  isDefault: boolean;
  states: CachedWorkflowState[];
  transitions: CachedWorkflowTransition[];
  /**
   * `'code'` — declared via `defineWorkflow()` and registered through
   * `WorkflowsModule.forFeature(...)`. Lives only in memory; never persisted
   * to `workflow_definitions`. Mutation endpoints reject these.
   * `'admin'` — created via the workflows API and persisted in the DB.
   */
  source: 'code' | 'admin';
}

export interface CachedWorkflowState {
  id: string;
  name: string;
  label: string;
  color: string | null;
  sortOrder: number;
  /** Code-load-bearing state — admin UI must block rename/delete. */
  isSystem: boolean;
  metadata: Record<string, unknown> | null;
}

export interface CachedWorkflowTransition {
  id: string;
  fromStateName: string;
  toStateName: string;
  name: string;
  requiredPermissions: string[];
  sortOrder: number;
  reasonOptions: string[] | null;
  reasonRequired: boolean;
  commentRequired: boolean;
  metadata: Record<string, unknown> | null;
}

// Result types
export interface AvailableTransition {
  transitionId: string;
  transitionName: string;
  toState: string;
  toStateLabel: string;
  toStateColor: string | null;
  requiredPermissions: string[];
  reasonOptions: string[] | null;
  reasonRequired: boolean;
  commentRequired: boolean;
}

export interface TransitionHistoryEntry {
  id: string;
  workflowDefinitionId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  fromState: string;
  toState: string;
  transitionId: string | null;
  actorId: string | null;
  reason: string | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ValidationResult {
  valid: boolean;
  transitionId?: string;
  missingPermissions?: string[];
}

/** Returned by validateAndThrow() — everything the caller needs to record history and emit events */
export interface ValidatedTransition {
  transitionId: string;
  transitionName: string;
  workflowDefinitionId: string;
  workflowName: string;
  fieldName: string;
}

/** Parameters for recording a transition in the history table */
export interface RecordHistoryParams {
  workflowDefinitionId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  fromState: string;
  toState: string;
  transitionId: string;
  actorId: string | null;
  reason?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
}
