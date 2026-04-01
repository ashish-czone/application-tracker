export { AutomationsPage } from './pages/AutomationsPage';
export { AutomationsListPage } from './pages/AutomationsListPage';
export { RuleBuilderPage } from './pages/RuleBuilderPage';
export { TemplatesListPage } from './pages/TemplatesListPage';
export { ConditionBuilder } from './components/ConditionBuilder';
export { TemplateFormModal } from './components/TemplateFormModal';
export {
  useAutomationRules, useAutomationRule, useCreateAutomationRule, useUpdateAutomationRule,
  useDeleteAutomationRule, useToggleAutomationRule,
  useRules, useRule, useCreateRule, useUpdateRule, useDeleteRule, useToggleRule,
  useTemplates, useTemplate, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
  useEvents, useEntities, useActionTypes, useUserStrategies, useEntityFields,
} from './hooks';
export { createNotificationsApi, type NotificationsApi } from './services';
export type {
  AutomationRule, ActionConfig, UserResolution, LifecycleUpdateBinding, LifecycleDeleteBinding,
  CreateAutomationRuleRequest, UpdateAutomationRuleRequest, ListAutomationRulesParams,
  ActionTypeMetadata, UserStrategyMetadata, UserResolutionStrategy,
  NotificationRule, NotificationTemplate, NotificationChannel, TriggerType,
  RecipientStrategy, Condition, RuleChannel, EventMetadata, EntityMetadata,
  CreateRuleRequest, UpdateRuleRequest, ListRulesParams,
  CreateTemplateRequest, UpdateTemplateRequest, ListTemplatesParams,
} from './types';
