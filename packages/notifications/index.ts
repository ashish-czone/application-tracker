export { NotificationsModule } from './notifications.module';
export { NotificationDispatcher } from './services/notification-dispatcher';
export { PreferenceService } from './services/preference.service';
export { NotificationTemplatesService } from './services/notification-templates.service';
export { NotificationRulesService } from './services/notification-rules.service';
export { EntityResolverRegistry } from './services/entity-resolver-registry';
export { ContactResolverRegistry, type ContactResolverFn } from './services/contact-resolver-registry';
export { NotificationQueryService, type NotificationRecord, type ListNotificationsQuery } from './services/notification-query.service';
export { buildConditions } from './helpers/condition-builder';
export type {
  NotificationChannel,
  RecipientStrategy,
  TriggerType,
  ScheduleDateOperator,
  ScheduleUnit,
  Condition,
  ConditionOperator,
  NotificationRule,
  NotificationTemplate,
  RenderedNotification,
  ChannelProvider,
  ChannelContext,
  EntityResolverConfig,
  FieldType,
  FieldConfig,
  ResolvedFieldConfig,
  RecipientFieldConfig,
} from './types';
export {
  notificationTemplates,
  notificationRules,
  notificationRuleChannels,
  notifications,
  notificationPreferences,
  notificationScheduled,
  notificationSentLog,
} from './schema';
