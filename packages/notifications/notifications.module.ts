import { Module, type OnModuleInit } from '@nestjs/common';
import { QueueService } from '@packages/queue';
import { NotificationRuleService } from './services/notification-rule.service';
import { RecipientResolver } from './services/recipient-resolver';
import { PreferenceService } from './services/preference.service';
import { TemplateRenderer } from './services/template-renderer';
import { NotificationDispatcher } from './services/notification-dispatcher';
import { NotificationListener } from './listeners/notification.listener';
import { InAppChannel } from './channels/in-app.channel';
import { EmailChannel, EMAIL_QUEUE_NAME } from './channels/email.channel';
import { WhatsAppChannel, WHATSAPP_QUEUE_NAME } from './channels/whatsapp.channel';
import { Logger } from '@nestjs/common';

@Module({
  providers: [
    NotificationRuleService,
    RecipientResolver,
    PreferenceService,
    TemplateRenderer,
    NotificationDispatcher,
    NotificationListener,
    InAppChannel,
    EmailChannel,
    WhatsAppChannel,
  ],
  exports: [NotificationDispatcher, PreferenceService],
})
export class NotificationsModule implements OnModuleInit {
  private readonly logger = new Logger(NotificationsModule.name);

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly inAppChannel: InAppChannel,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit() {
    // Register channel providers with the dispatcher
    this.dispatcher.registerChannel(this.inAppChannel);
    this.dispatcher.registerChannel(this.emailChannel);
    this.dispatcher.registerChannel(this.whatsAppChannel);

    // Register queue processors for async channels
    this.queueService.registerProcessor({
      name: EMAIL_QUEUE_NAME,
      handler: async (data) => {
        // TODO: Integrate with actual email provider (SMTP/SendGrid/SES)
        this.logger.log({ ...data as Record<string, unknown> }, 'Email job processed (provider not configured)');
      },
    });

    this.queueService.registerProcessor({
      name: WHATSAPP_QUEUE_NAME,
      handler: async (data) => {
        // TODO: Integrate with actual WhatsApp provider (Twilio/WhatsApp Business API)
        this.logger.log({ ...data as Record<string, unknown> }, 'WhatsApp job processed (provider not configured)');
      },
    });
  }
}
