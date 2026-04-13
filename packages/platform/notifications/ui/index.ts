// --- Notifications (templates & channels) ---
export { AutomationsPage } from './pages/AutomationsPage';
export { TemplatesListPage } from './pages/TemplatesListPage';
export { TemplateFormModal } from './components/TemplateFormModal';
export {
  useTemplates, useTemplate, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
} from './hooks';
export { createNotificationsApi, type NotificationsApi } from './services';
export type {
  NotificationTemplate, NotificationChannel,
  CreateTemplateRequest, UpdateTemplateRequest, ListTemplatesParams,
} from './types';

// --- Re-export from automations for backwards compatibility ---
export { AutomationsListPage, RuleBuilderPage, ExecutionLogPage } from '@packages/automations-ui';
export {
  useAutomationRules, useAutomationRule, useCreateAutomationRule, useUpdateAutomationRule,
  useDeleteAutomationRule, useToggleAutomationRule,
  useEvents, useEntities, useActionTypes, useUserStrategies, useEntityFields,
  useAutomationExecutions,
} from '@packages/automations-ui';
export type {
  AutomationRule, AutomationExecution, ActionConfig, UserResolution,
  LifecycleUpdateBinding, LifecycleDeleteBinding,
  CreateAutomationRuleRequest, UpdateAutomationRuleRequest,
  ListAutomationRulesParams, ListExecutionsParams,
  ActionTypeMetadata, UserStrategyMetadata, UserResolutionStrategy,
  TriggerType, Condition, EventMetadata, EntityMetadata,
} from '@packages/automations-ui';
