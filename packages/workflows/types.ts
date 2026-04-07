// Guard function signature: receives context, returns true to allow, false to reject
export interface WorkflowGuardContext {
  workflowSlug: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  fromState: string;
  toState: string;
  actorId: string | null;
  metadata?: Record<string, unknown>;
}

export type WorkflowGuardFn = (context: WorkflowGuardContext) => Promise<boolean>;

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
}

export interface CachedWorkflowState {
  id: string;
  name: string;
  label: string;
  color: string | null;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
}

export interface CachedWorkflowTransition {
  id: string;
  fromStateName: string;
  toStateName: string;
  name: string;
  requiredPermissions: string[];
  guardNames: string[];
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
  failedGuard?: string;
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

