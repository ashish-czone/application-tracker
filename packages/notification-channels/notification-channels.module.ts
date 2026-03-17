import { Module, type OnModuleInit, Logger } from '@nestjs/common';
import { EmailChannelService } from './email/email-channel.service';
import { ConsoleEmailProvider } from './email/providers/console-email.provider';
import { SmtpEmailProvider } from './email/providers/smtp-email.provider';
import { WhatsAppChannelService } from './whatsapp/whatsapp-channel.service';
import { ConsoleWhatsAppProvider } from './whatsapp/providers/console-whatsapp.provider';
import { TwilioWhatsAppProvider } from './whatsapp/providers/twilio-whatsapp.provider';

@Module({
  providers: [
    EmailChannelService,
    ConsoleEmailProvider,
    SmtpEmailProvider,
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
    private readonly smtpEmailProvider: SmtpEmailProvider,
    private readonly whatsAppChannel: WhatsAppChannelService,
    private readonly consoleWhatsAppProvider: ConsoleWhatsAppProvider,
    private readonly twilioWhatsAppProvider: TwilioWhatsAppProvider,
  ) {}

  onModuleInit() {
    // Register email providers
    this.emailChannel.registerProvider(this.consoleEmailProvider);

    // Configure and register SMTP if env vars are present
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM;
    if (smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom) {
      this.smtpEmailProvider.configure({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: parseInt(smtpPort, 10) === 465,
        auth: { user: smtpUser, pass: smtpPass },
        from: smtpFrom,
      });
      this.emailChannel.registerProvider(this.smtpEmailProvider);
    }

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
