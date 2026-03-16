export { NotificationsModule } from './notifications.module';
export { NotificationDispatcher } from './services/notification-dispatcher';
export { PreferenceService } from './services/preference.service';
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
