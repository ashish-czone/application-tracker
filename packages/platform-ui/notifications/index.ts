export { AutomationsPage } from './pages/AutomationsPage';
export { AutomationsListPage } from './pages/AutomationsListPage';
export { RuleBuilderPage } from './pages/RuleBuilderPage';
export { TemplatesListPage } from './pages/TemplatesListPage';
export { ConditionBuilder } from './components/ConditionBuilder';
export { TemplateFormModal } from './components/TemplateFormModal';
export {
  useRules, useRule, useCreateRule, useUpdateRule, useDeleteRule, useToggleRule,
  useTemplates, useTemplate, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
  useEvents, useEntities, useEntityFields,
} from './hooks';
export { createNotificationsApi, type NotificationsApi } from './services';
export type {
  NotificationRule, NotificationTemplate, NotificationChannel, TriggerType,
  RecipientStrategy, Condition, RuleChannel, EventMetadata, EntityMetadata,
  CreateRuleRequest, UpdateRuleRequest, ListRulesParams,
  CreateTemplateRequest, UpdateTemplateRequest, ListTemplatesParams,
} from './types';
