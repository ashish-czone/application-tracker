export { NotificationsModule } from './notifications.module';
export { NotificationDispatcher } from './services/notification-dispatcher';
export { PreferenceService } from './services/preference.service';
export { NotificationTemplatesService } from './services/notification-templates.service';
export { NotificationRulesService } from './services/notification-rules.service';
export type {
  NotificationChannel,
  RecipientStrategy,
  NotificationRule,
  NotificationTemplate,
  RenderedNotification,
  ChannelProvider,
  ChannelContext,
} from './types';
export {
  notificationTemplates,
  notificationRules,
  notificationRuleChannels,
  notifications,
  notificationPreferences,
} from './schema';
