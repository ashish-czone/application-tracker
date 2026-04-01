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
export { AutomationsListPage, RuleBuilderPage } from '../automations';
export {
  useAutomationRules, useAutomationRule, useCreateAutomationRule, useUpdateAutomationRule,
  useDeleteAutomationRule, useToggleAutomationRule,
  useEvents, useEntities, useActionTypes, useUserStrategies, useEntityFields,
} from '../automations';
export type {
  AutomationRule, ActionConfig, UserResolution, LifecycleUpdateBinding, LifecycleDeleteBinding,
  CreateAutomationRuleRequest, UpdateAutomationRuleRequest, ListAutomationRulesParams,
  ActionTypeMetadata, UserStrategyMetadata, UserResolutionStrategy,
  TriggerType, Condition, EventMetadata, EntityMetadata,
} from '../automations';
