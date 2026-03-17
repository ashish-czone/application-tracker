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
}

export interface TransitionResult {
  historyId: string;
  fromState: string;
  toState: string;
  transitionId: string;
  recordedAt: string;
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
  comment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface TransitionParams {
  workflowSlug: string;
  entityType: string;
  entityId: string;
  fromState: string;
  toState: string;
  actorId: string | null;
  comment?: string;
  metadata?: Record<string, unknown>;
  additionalGuards?: WorkflowGuardFn[];
  tx?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  transitionId?: string;
  failedGuard?: string;
  missingPermissions?: string[];
}

// Event types
export const WORKFLOWS_TRANSITION_COMPLETED = 'workflows.TransitionCompleted' as const;

export interface WorkflowTransitionCompletedEvent {
  workflowSlug: string;
  workflowName: string;
  fieldName: string;
  fromState: string;
  toState: string;
  transitionId: string;
  transitionName: string;
  comment?: string;
}

declare module '@packages/events' {
  interface EventPayloadMap {
    [WORKFLOWS_TRANSITION_COMPLETED]: WorkflowTransitionCompletedEvent;
  }
}
