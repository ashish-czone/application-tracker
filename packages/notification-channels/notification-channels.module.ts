import { Module, type OnModuleInit, Logger } from '@nestjs/common';
import { EmailChannelService } from './email/email-channel.service';
import { ConsoleEmailProvider } from './email/providers/console-email.provider';
import { WhatsAppChannelService } from './whatsapp/whatsapp-channel.service';
import { ConsoleWhatsAppProvider } from './whatsapp/providers/console-whatsapp.provider';
import { TwilioWhatsAppProvider } from './whatsapp/providers/twilio-whatsapp.provider';

@Module({
  providers: [
    EmailChannelService,
    ConsoleEmailProvider,
    WhatsAppChannelService,
    ConsoleWhatsAppProvider,
    TwilioWhatsAppProvider,
  ],
  exports: [
    EmailChannelService,
    WhatsAppChannelService,
  ],
})
export class NotificationChannelsModule implements OnModuleInit {
  private readonly logger = new Logger(NotificationChannelsModule.name);

  constructor(
    private readonly emailChannel: EmailChannelService,
    private readonly consoleEmailProvider: ConsoleEmailProvider,
    private readonly whatsAppChannel: WhatsAppChannelService,
    private readonly consoleWhatsAppProvider: ConsoleWhatsAppProvider,
    private readonly twilioWhatsAppProvider: TwilioWhatsAppProvider,
  ) {}

  onModuleInit() {
    // Register email providers
    this.emailChannel.registerProvider(this.consoleEmailProvider);

    // Register WhatsApp providers
    this.whatsAppChannel.registerProvider(this.consoleWhatsAppProvider);
    this.whatsAppChannel.registerProvider(this.twilioWhatsAppProvider);

    // Set active providers from env (default to console for dev)
    const emailProvider = process.env.EMAIL_PROVIDER ?? 'console';
    const whatsAppProvider = process.env.WHATSAPP_PROVIDER ?? 'console';

    try {
      this.emailChannel.setActiveProvider(emailProvider);
    } catch {
      this.logger.warn(`Email provider "${emailProvider}" not registered — email delivery disabled`);
    }

    try {
      this.whatsAppChannel.setActiveProvider(whatsAppProvider);
    } catch {
      this.logger.warn(`WhatsApp provider "${whatsAppProvider}" not registered — WhatsApp delivery disabled`);
    }

    // Configure Twilio if env vars are present
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
    if (twilioSid && twilioToken && twilioFrom) {
      this.twilioWhatsAppProvider.configure({
        accountSid: twilioSid,
        authToken: twilioToken,
        fromNumber: twilioFrom,
      });
    }
  }
}
