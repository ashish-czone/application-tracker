export { NotificationChannelsModule } from './notification-channels.module';
export { EmailChannelService } from './email/email-channel.service';
export { WhatsAppChannelService } from './whatsapp/whatsapp-channel.service';
export { ConsoleEmailProvider } from './email/providers/console-email.provider';
export { SmtpEmailProvider, type SmtpConfig } from './email/providers/smtp-email.provider';
export { ConsoleWhatsAppProvider } from './whatsapp/providers/console-whatsapp.provider';
export { TwilioWhatsAppProvider, type TwilioWhatsAppConfig } from './whatsapp/providers/twilio-whatsapp.provider';
export { InAppChannel } from './in-app/in-app.channel';
export { NotificationQueryService, type NotificationRecord, type ListNotificationsQuery } from './in-app/notification-query.service';
export { notifications } from './schema/notifications';
export type {
  NotificationChannel,
  RenderedNotification,
  ChannelProvider,
  ChannelContext,
  EmailProvider,
  EmailPayload,
  EmailAttachment,
  WhatsAppProvider,
  WhatsAppPayload,
  SendResult,
} from './types';
