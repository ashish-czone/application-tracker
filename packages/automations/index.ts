export { AUTOMATION_PERMISSIONS } from './permissions';
export { ActionRegistry } from './services/action-registry';
export { UserResolverRegistry, type UserResolverStrategy, type UserResolutionContext } from './services/user-resolver-registry';
export { ActorStrategy } from './services/strategies/actor.strategy';
export { EntityFieldStrategy } from './services/strategies/entity-field.strategy';
export { RoleStrategy } from './services/strategies/role.strategy';
export type {
  TriggerType,
  ScheduleDateOperator,
  ScheduleUnit,
  UserSlotDefinition,
  UserResolutionStrategy,
  UserResolution,
  ActionConfig,
  ActionContext,
  ActionResult,
  ActionHandler,
  LifecycleUpdateBinding,
  LifecycleDeleteBinding,
  AutomationRule,
  AutomationActionLogEntry,
  EntityFieldType,
  EntityFieldConfig,
  ResolvedEntityFieldConfig,
  EntityUserFieldConfig,
  EntityResolverConfig,
} from './types';
export {
  automationRules,
  automationActionLog,
  automationScheduled,
  automationSentLog,
} from './schema';
