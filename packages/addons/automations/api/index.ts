import { AutomationsModule, AUTOMATION_EXECUTION_QUEUE } from './automations.module';
export { AutomationsModule, AUTOMATION_EXECUTION_QUEUE };

export const automationsAddon = {
  module: AutomationsModule,
  migration: '@packages/automations',
} as const;
export { AUTOMATION_PERMISSIONS } from './permissions';
export { ActorStrategy } from './services/strategies/actor.strategy';
export { EntityFieldStrategy } from './services/strategies/entity-field.strategy';
export { RoleStrategy } from './services/strategies/role.strategy';
export { RelatedEntityFieldStrategy } from './services/strategies/related-entity-field.strategy';
export { AutomationRuleService } from './services/automation-rule.service';
export { ProvenanceService } from './services/provenance.service';
export { ExecutionLogService } from './services/execution-log.service';
export { LifecycleEngine } from './services/lifecycle-engine';
export { ScheduleScanner } from './services/schedule-scanner';
export { AutomationListener } from './listeners/automation.listener';
export { WebhookAction } from './services/actions/webhook.action';
export {
  automationRules,
  automationActionLog,
  automationExecutions,
  automationScheduled,
  automationSentLog,
} from './schema';

// Re-export registries and types from automation-contracts for backward compatibility
export {
  ActionRegistry,
  EntityResolverRegistry,
  UserResolverRegistry,
  type UserResolverStrategy,
  type UserResolutionContext,
} from '@packages/automation-contracts';
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
} from '@packages/automation-contracts';
