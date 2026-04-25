export { AutomationsListPage } from './pages/AutomationsListPage';
export { AutomationsPage } from './pages/AutomationsPage';
export { RuleBuilderPage } from './pages/RuleBuilderPage';
export { ConditionBuilder } from './components/ConditionBuilder';
export { EntityCreateActionConfig } from './components/EntityCreateActionConfig';
export { EntityUpdateActionConfig } from './components/EntityUpdateActionConfig';
export { ExecutionLogPage } from './pages/ExecutionLogPage';
export {
  useAutomationRules, useAutomationRule, useCreateAutomationRule, useUpdateAutomationRule,
  useDeleteAutomationRule, useToggleAutomationRule,
  useEvents, useEntities, useActionTypes, useUserStrategies, useEntityFields,
  useAutomationExecutions,
} from './hooks';
export { createAutomationsApi, type AutomationsApi } from './services';
export type {
  AutomationRule, AutomationExecution, ActionConfig, UserResolution,
  LifecycleUpdateBinding, LifecycleDeleteBinding,
  CreateAutomationRuleRequest, UpdateAutomationRuleRequest,
  ListAutomationRulesParams, ListExecutionsParams,
  ActionTypeMetadata, UserStrategyMetadata, UserResolutionStrategy,
  TriggerType, Condition, EventMetadata, EntityMetadata,
} from './types';

// WebFeatureManifest entry — apps pass to WebShell.features
export { automationsWeb } from './manifest';
