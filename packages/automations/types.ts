import type { Condition } from '@packages/common';

// ---------------------------------------------------------------------------
// Trigger types
// ---------------------------------------------------------------------------

export type TriggerType = 'event' | 'schedule_once' | 'schedule_recurring';

export type ScheduleDateOperator = 'before' | 'after';

export type ScheduleUnit = 'minutes' | 'hours' | 'days';

// ---------------------------------------------------------------------------
// User resolution — how actions resolve users (recipient, assignee, etc.)
// ---------------------------------------------------------------------------

export interface UserSlotDefinition {
  name: string;
  label: string;
  required: boolean;
}

export type UserResolutionStrategy = 'actor' | 'entity_field' | 'role';

export interface UserResolution {
  strategy: UserResolutionStrategy;
  config?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Actions — pluggable action handlers
// ---------------------------------------------------------------------------

export interface ActionConfig {
  type: string;
  config: Record<string, unknown>;
  users?: Record<string, UserResolution>;
  link?: { as: string };
}

export interface ActionContext {
  rule: AutomationRule;
  actionIndex: number;
  actionConfig: ActionConfig;
  event?: {
    eventName: string;
    entityType: string;
    entityId: string;
    actorId: string | null;
    correlationId: string;
    payload: Record<string, unknown>;
  };
  entityType?: string;
  entityId?: string;
  entityData?: Record<string, unknown>;
  resolvedUsers: Record<string, string[]>;
}

export interface ActionResult {
  targetEntityType?: string;
  targetEntityId?: string;
}

export interface ActionHandler {
  readonly type: string;
  readonly label: string;
  readonly userSlots: UserSlotDefinition[];
  readonly configSchema: Record<string, unknown>;

  execute(context: ActionContext): Promise<ActionResult>;
  update?(targetEntityId: string, set: Record<string, unknown>, context: ActionContext): Promise<void>;
  delete?(targetEntityId: string, context: ActionContext): Promise<void>;
}

// ---------------------------------------------------------------------------
// Lifecycle bindings — declarative linked entity lifecycle
// ---------------------------------------------------------------------------

export interface LifecycleUpdateBinding {
  conditions?: Condition[];
  linked: string;
  action: 'update';
  set: Record<string, unknown>;
}

export interface LifecycleDeleteBinding {
  linked: string;
  action: 'update' | 'delete';
  set?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Rule — the full automation rule shape
// ---------------------------------------------------------------------------

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;

  // Event trigger
  eventName: string | null;
  delayAmount: number | null;
  delayUnit: ScheduleUnit | null;

  // Schedule trigger
  scheduleEntityType: string | null;
  scheduleDateField: string | null;
  scheduleDateOperator: ScheduleDateOperator | null;
  scheduleDateAmounts: number[] | null;
  scheduleDateUnit: ScheduleUnit | null;
  scheduleDaysOfWeek: number[] | null;

  // Shared
  conditions: Condition[] | null;
  actions: ActionConfig[];

  // Lifecycle
  onSourceUpdated: LifecycleUpdateBinding[] | null;
  onSourceDeleted: LifecycleDeleteBinding[] | null;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Provenance — action log for tracking linked entities
// ---------------------------------------------------------------------------

export interface AutomationActionLogEntry {
  id: string;
  ruleId: string;
  actionIndex: number;
  linkName: string | null;
  sourceEntityType: string;
  sourceEntityId: string;
  targetEntityType: string;
  targetEntityId: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Entity resolver — metadata for entities that automations can act on
// ---------------------------------------------------------------------------

export type EntityFieldType = 'text' | 'number' | 'date' | 'enum' | 'uuid' | 'boolean';

export interface EntityFieldConfig {
  type: EntityFieldType;
  label: string;
  options?: string[];
  resolveOptions?: () => Promise<string[]> | string[];
}

export interface ResolvedEntityFieldConfig {
  type: EntityFieldType;
  label: string;
  options?: string[];
}

export interface EntityUserFieldConfig {
  label: string;
}

export interface EntityResolverConfig {
  table: any;
  fields: Record<string, EntityFieldConfig>;
  userFields: Record<string, EntityUserFieldConfig>;
}
