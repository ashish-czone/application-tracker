export { AutomationsListPage } from './pages/AutomationsListPage';
export { RuleBuilderPage } from './pages/RuleBuilderPage';
export { ConditionBuilder } from './components/ConditionBuilder';
export {
  useAutomationRules, useAutomationRule, useCreateAutomationRule, useUpdateAutomationRule,
  useDeleteAutomationRule, useToggleAutomationRule,
  useEvents, useEntities, useActionTypes, useUserStrategies, useEntityFields,
} from './hooks';
export { createAutomationsApi, type AutomationsApi } from './services';
export type {
  AutomationRule, ActionConfig, UserResolution, LifecycleUpdateBinding, LifecycleDeleteBinding,
  CreateAutomationRuleRequest, UpdateAutomationRuleRequest, ListAutomationRulesParams,
  ActionTypeMetadata, UserStrategyMetadata, UserResolutionStrategy,
  TriggerType, Condition, EventMetadata, EntityMetadata,
} from './types';
