/**
 * Per-module workflow declaration. Replaces the workflow block previously
 * embedded inside `defineEntity({ fields: { status: { type: 'workflow', workflow: {...} } } })`.
 *
 * Pair with `WorkflowsModule.forFeature(def)` to register at module init.
 *
 * Why these types live here (not in entity-engine): workflows are an addon
 * that should work without the entity-engine present. Modules using
 * defineWorkflow + WorkflowsModule.forFeature don't need entity-engine in
 * their dependency graph — the per-module workflow lives entirely in the
 * workflows package.
 */

export interface WorkflowStateDefinition {
  /** State identifier (stored in DB). */
  name: string;
  /** Display label. */
  label: string;
  /** Color for UI badges (hex). */
  color?: string;
  /**
   * Canonical state wired into code (e.g. terminal states the engine checks
   * by name). Admin UIs must block rename/delete on system states; non-system
   * states can be added/renamed/removed freely.
   */
  isSystem?: boolean;
}

export interface WorkflowTransitionTarget {
  /** Target state name. */
  state: string;
  /** Additional permissions required for this transition. */
  requiredPermissions?: string[];
  /** Require the actor to supply a reason (validated against `reasonOptions` if set). */
  reasonRequired?: boolean;
  /** Require the actor to supply a free-text comment. */
  commentRequired?: boolean;
  /** Constrained list of allowed values for `reason` — values outside this list are rejected. */
  reasonOptions?: string[];
}

export interface WorkflowTransitionDefinition {
  /** Source state name. */
  from: string;
  /** Possible target states — plain string (no conditions) or object (with conditions/permissions). */
  to: (string | WorkflowTransitionTarget)[];
}

export interface WorkflowDefinition {
  /** Globally unique slug, e.g. 'compliance-rule-status'. */
  slug: string;
  /** Entity type the workflow gates, e.g. 'compliance-rules'. Used by the runtime to resolve the workflow on a transition request. */
  entityType: string;
  /** Field on the entity holding the current state, typically 'status'. */
  fieldName: string;
  /** Display name for admin UI (defaults to slug). */
  name?: string;
  /** State name to set on entity create. */
  initialState: string;
  states: WorkflowStateDefinition[];
  transitions: WorkflowTransitionDefinition[];
}

/**
 * Type-only factory for declaring a workflow. Returns the input unchanged
 * (after type-checking). Pair with `WorkflowsModule.forFeature(def)` to
 * register with the workflow registry at module init.
 *
 * @example
 *   export const RULES_WORKFLOW = defineWorkflow({
 *     slug: 'compliance-rule-status',
 *     entityType: 'compliance-rules',
 *     fieldName: 'status',
 *     initialState: 'draft',
 *     states: [
 *       { name: 'draft',  label: 'Draft',  color: '#6B7280', isSystem: true },
 *       { name: 'active', label: 'Active', color: '#10B981', isSystem: true },
 *     ],
 *     transitions: [
 *       { from: 'draft', to: ['active'] },
 *     ],
 *   });
 */
export function defineWorkflow(definition: WorkflowDefinition): WorkflowDefinition {
  return definition;
}
