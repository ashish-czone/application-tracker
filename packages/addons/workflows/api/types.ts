// Guard function signature: receives context, returns a GuardResult telling
// the engine (and UI preflight) whether to allow the transition and what
// message to surface to the user.
//
// - `allow` — transition may proceed, no message.
// - `allow_with_warning` — transition may proceed but the UI should show a
//   warning banner so the user confirms knowingly (e.g. "N filings will be
//   cancelled when this client is dormantised"). Preflight surfaces it
//   before the dialog's confirm button is clicked; the engine still records
//   the transition on confirm without re-evaluating the warning.
// - `block` — transition is rejected. The UI surfaces the message in the
//   preflight banner and disables confirm; `validateAndThrow` raises
//   UnprocessableEntityException with the same message on the server side.
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

export type GuardResult =
  | { decision: 'allow' }
  | { decision: 'allow_with_warning'; message: string }
  | { decision: 'block'; message: string };

export type WorkflowGuardFn = (context: WorkflowGuardContext) => Promise<GuardResult>;

export const allow = (): GuardResult => ({ decision: 'allow' });
export const allowWithWarning = (message: string): GuardResult => ({
  decision: 'allow_with_warning',
  message,
});
export const block = (message: string): GuardResult => ({ decision: 'block', message });

/**
 * Result of running all guards for a transition. Collects every warning and
 * blocker so the UI preflight banner can list them together rather than
 * short-circuiting on the first one.
 */
export interface GuardExecutionResult {
  warnings: string[];
  blockers: Array<{ guardName: string; message: string }>;
}

/**
 * Preflight of a proposed transition: everything the UI needs to decide
 * whether to enable the confirm button and what banners to show.
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
  blockerMessage?: string;
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

