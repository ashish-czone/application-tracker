export { NotificationChannelsModule } from './notification-channels.module';
export { EmailChannelService } from './email/email-channel.service';
export { WhatsAppChannelService } from './whatsapp/whatsapp-channel.service';
export { ConsoleEmailProvider } from './email/providers/console-email.provider';
export { ConsoleWhatsAppProvider } from './whatsapp/providers/console-whatsapp.provider';
export { TwilioWhatsAppProvider, type TwilioWhatsAppConfig } from './whatsapp/providers/twilio-whatsapp.provider';
export type {
  EmailProvider,
  EmailPayload,
  WhatsAppProvider,
  WhatsAppPayload,
  SendResult,
} from './types';
