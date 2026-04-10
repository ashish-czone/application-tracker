/**
 * Interface for workflow operations.
 * Implemented by @packages/workflows when loaded.
 * When not loaded, workflow seeding, transitions, and pipeline resolution are skipped.
 */
export interface WorkflowExtension {
  // --- Seeding (bootstrap-time) ---

  /** Get a cached workflow definition by slug. Returns undefined if not found. */
  getBySlug(slug: string): WorkflowDefinitionRef | undefined;

  /** Create a new workflow definition. */
  createDefinition(data: {
    slug: string;
    name: string;
    entityType: string;
    fieldName: string;
    initialState: string;
  }): Promise<{ id: string }>;

  /** Create a state on a workflow definition. */
  createState(definitionId: string, data: {
    name: string;
    label: string;
    color?: string;
    sortOrder: number;
  }): Promise<{ id: string }>;

  /** Create a transition between states. */
  createTransition(definitionId: string, data: {
    fromStateId: string;
    toStateId: string;
    name: string;
    requiredPermissions?: string[];
    guardNames?: string[];
    sortOrder: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }>;

  /** Register a custom workflow guard function. */
  registerGuard(name: string, fn: WorkflowGuardFn): void;

  // --- Runtime ---

  /** Resolve the workflow for a transition (check assignment, fall back to default). */
  resolveForTransition(entityType: string, entityId: string, fieldName: string): Promise<WorkflowDefinitionRef | undefined>;

  /** Resolve and assign a pipeline to an entity (used on create). */
  resolveAndAssign(entityType: string, entityId: string, fieldName: string, discriminatorValue?: string): Promise<WorkflowDefinitionRef | undefined>;

  /** Validate a transition and throw on failure. Returns transition metadata. */
  validateAndThrow(params: {
    workflowSlug: string;
    entityType: string;
    entityId: string;
    fromState: string;
    toState: string;
    actorId: string | null;
    entityData?: Record<string, unknown>;
  }): Promise<ValidatedTransition>;

  /** Record a transition in the history table. */
  recordHistory(data: {
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
  }, tx?: unknown): Promise<void>;
}

/** Minimal workflow definition shape entity-engine needs for runtime. */
export interface WorkflowDefinitionRef {
  id: string;
  slug: string;
  transitions: WorkflowTransitionRef[];
}

export interface WorkflowTransitionRef {
  id: string;
  fromStateName: string;
  toStateName: string;
  name: string;
  reasonRequired?: boolean;
  commentRequired?: boolean;
  reasonOptions?: string[];
}

export interface ValidatedTransition {
  transitionId: string;
  transitionName: string;
  workflowDefinitionId: string;
  fieldName: string;
}

/** Guard function signature — receives context, returns true to allow. */
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

/** NestJS injection token for the workflow extension. */
export const WORKFLOW_EXTENSION = 'WORKFLOW_EXTENSION';
