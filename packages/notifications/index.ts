export { NotificationsModule } from './notifications.module';
export { NOTIFICATION_PERMISSIONS } from './permissions';
export { NotificationDispatcher } from './services/notification-dispatcher';
export { PreferenceService } from './services/preference.service';
export { NotificationTemplatesService } from './services/notification-templates.service';
export { ContactResolverRegistry, type ContactResolverFn } from './services/contact-resolver-registry';
export { SendNotificationAction } from './services/send-notification.action';
export type {
  NotificationChannel,
  NotificationTemplate,
  RenderedNotification,
  ChannelProvider,
  ChannelContext,
} from './types';
export {
  notificationTemplates,
  notificationPreferences,
} from './schema';
