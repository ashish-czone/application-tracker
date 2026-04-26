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

  /**
   * Update an existing workflow definition. Used by `seedWorkflows` to
   * re-sync a definition row's `entityType`/`fieldName`/`name`/`initialState`
   * to the current config when an entity slug or workflow shape changes —
   * without this, dev DBs seeded under an older slug would silently keep
   * pointing transitions at the wrong entity.
   */
  updateDefinition(id: string, data: Partial<{
    name: string;
    entityType: string;
    fieldName: string;
    initialState: string;
  }>): Promise<{ id: string }>;

  /** Create a state on a workflow definition. */
  createState(definitionId: string, data: {
    name: string;
    label: string;
    color?: string;
    sortOrder: number;
    isSystem?: boolean;
  }): Promise<{ id: string }>;

  /** Create a transition between states. */
  createTransition(definitionId: string, data: {
    fromStateId: string;
    toStateId: string;
    name: string;
    requiredPermissions?: string[];
    sortOrder: number;
    metadata?: Record<string, unknown>;
    reasonRequired?: boolean;
    commentRequired?: boolean;
    reasonOptions?: string[];
  }): Promise<{ id: string }>;

  // --- Runtime ---

  /** Resolve the workflow for a transition (check assignment, fall back to default). */
  resolveForTransition(entityType: string, entityId: string, fieldName: string): Promise<WorkflowDefinitionRef | undefined>;

  /** Resolve and assign a pipeline to an entity (used on create). */
  resolveAndAssign(entityType: string, entityId: string, fieldName: string, discriminatorValue?: string): Promise<WorkflowDefinitionRef | undefined>;

  /** Validate a transition and throw on failure. Returns transition metadata.
   * Validates state-machine legality, permissions, and conditions only —
   * per-entity guards run before this is called, in the per-entity service. */
  validateAndThrow(params: {
    workflowSlug: string;
    entityType: string;
    entityId: string;
    fromState: string;
    toState: string;
    actorId: string | null;
    entityData?: Record<string, unknown>;
  }): Promise<ValidatedTransition>;

  /** Dry-run a transition: returns legality + missing permissions without
   * touching the database. Per-entity services call this from their own
   * preview methods, then merge in their own guard preview results. */
  preflightTransition(params: {
    workflowSlug: string;
    entityType: string;
    entityId: string;
    fromState: string;
    toState: string;
    actorId: string | null;
  }): Promise<{
    transitionId: string | null;
    warnings: string[];
    blockers: string[];
    missingPermissions: string[];
  }>;

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

/** NestJS injection token for the workflow extension. */
export const WORKFLOW_EXTENSION = 'WORKFLOW_EXTENSION';
