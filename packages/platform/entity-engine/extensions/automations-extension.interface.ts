/**
 * Interface for automation registration operations.
 * Implemented by @packages/automations when loaded.
 * When not loaded, action handlers and entity resolvers are not registered.
 */
export interface AutomationsExtension {
  /** Register an action handler with the automation system. */
  registerAction(handler: ActionHandlerDef): void;

  /** Register an entity type for use in automation conditions and schedule triggers. */
  registerEntityResolver(entityType: string, config: EntityResolverConfig): void;
}

/** Action handler definition — entity-engine's own contract, independent of automations types. */
export interface ActionHandlerDef {
  readonly type: string;
  readonly label: string;
  readonly userSlots: { name: string; label: string; required: boolean }[];
  readonly configSchema: Record<string, unknown>;

  execute(context: ActionExecutionContext): Promise<ActionExecutionResult>;
  update?(targetEntityId: string, set: Record<string, unknown>, context: ActionExecutionContext): Promise<void>;
  delete?(targetEntityId: string, context: ActionExecutionContext): Promise<void>;
}

/** Minimal action context — entity-engine's own type, structurally compatible with automations' ActionContext. */
export interface ActionExecutionContext {
  rule: { id: string; [key: string]: unknown };
  actionIndex: number;
  actionConfig: { type: string; config: Record<string, unknown>; [key: string]: unknown };
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

export interface ActionExecutionResult {
  targetEntityType?: string;
  targetEntityId?: string;
}

export interface EntityResolverConfig {
  table: unknown;
  fields: Record<string, EntityResolverFieldConfig>;
  userFields?: Record<string, unknown>;
}

export interface EntityResolverFieldConfig {
  type: 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'uuid';
  label: string;
  options?: string[];
  resolveOptions?: () => Promise<string[]>;
}

/** NestJS injection token for the automations extension. */
export const AUTOMATIONS_EXTENSION = 'AUTOMATIONS_EXTENSION';
