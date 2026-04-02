export { AutomationsModule, AUTOMATION_EXECUTION_QUEUE } from './automations.module';
export { AUTOMATION_PERMISSIONS } from './permissions';
export { ActionRegistry } from './services/action-registry';
export { UserResolverRegistry, type UserResolverStrategy, type UserResolutionContext } from './services/user-resolver-registry';
export { ActorStrategy } from './services/strategies/actor.strategy';
export { EntityFieldStrategy } from './services/strategies/entity-field.strategy';
export { RoleStrategy } from './services/strategies/role.strategy';
export { EntityResolverRegistry } from './services/entity-resolver-registry';
export { AutomationRuleService } from './services/automation-rule.service';
export { ProvenanceService } from './services/provenance.service';
export { LifecycleEngine } from './services/lifecycle-engine';
export { ScheduleScanner } from './services/schedule-scanner';
export { AutomationListener } from './listeners/automation.listener';
export { WebhookAction } from './services/actions/webhook.action';
export { buildConditions } from './helpers/condition-builder';
export { interpolateValues } from './helpers/interpolator';
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
  AutomationExecutionEntry,
  EntityFieldType,
  EntityFieldConfig,
  ResolvedEntityFieldConfig,
  EntityUserFieldConfig,
  EntityResolverConfig,
} from './types';
export {
  automationRules,
  automationActionLog,
  automationExecutions,
  automationScheduled,
  automationSentLog,
} from './schema';
