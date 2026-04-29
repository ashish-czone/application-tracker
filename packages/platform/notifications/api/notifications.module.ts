import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { QueueService } from '@packages/queue';
import { RbacIntegrationModule } from '@packages/rbac';
import { ActionRegistry } from '@packages/automation-contracts';
import { NotificationChannelsModule, EmailChannelService, WhatsAppChannelService, InAppChannel } from '@packages/notification-channels';
import type { EmailPayload, WhatsAppPayload } from '@packages/notification-channels';
import { NotificationTemplatesService } from './services/notification-templates.service';
import { PreferenceService } from './services/preference.service';
import { TemplateRenderer } from './services/template-renderer';
import { NotificationDispatcher, EMAIL_QUEUE_NAME, WHATSAPP_QUEUE_NAME } from './services/notification-dispatcher';
import { ContactResolverRegistry } from './services/contact-resolver-registry';
import { SendNotificationAction } from './services/send-notification.action';
import { NotificationTemplatesController } from './controllers/notification-templates.controller';

@Global()
@Module({
  imports: [
    NotificationChannelsModule,
    RbacIntegrationModule.forFeature({
      manifests: [
        { slug: 'notifications.templates.read',   module: 'notifications', action: 'templates.read',   label: 'View notification templates',   description: 'View notification templates',                                  supportedScopes: ['any'] },
        { slug: 'notifications.templates.manage', module: 'notifications', action: 'templates.manage', label: 'Manage notification templates', description: 'Create, update, and delete notification templates',           supportedScopes: ['any'] },
      ],
    }),
  ],
  controllers: [NotificationTemplatesController],
  providers: [
    NotificationTemplatesService,
    PreferenceService,
    TemplateRenderer,
    NotificationDispatcher,
    ContactResolverRegistry,
    SendNotificationAction,
  ],
  exports: [
    NotificationDispatcher,
    PreferenceService,
    NotificationTemplatesService,
    ContactResolverRegistry,
  ],
})
export class NotificationsModule implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly inAppChannel: InAppChannel,
    private readonly queueService: QueueService,
    private readonly emailChannelService: EmailChannelService,
    private readonly whatsAppChannelService: WhatsAppChannelService,
    private readonly actionRegistry: ActionRegistry,
    private readonly sendNotificationAction: SendNotificationAction,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(NotificationsModule.name);
  }

  async onModuleInit() {
    // Register inline channels
    this.dispatcher.registerInlineChannel(this.inAppChannel);

    // Register queue processors — delegate to notification-channels package
    this.queueService.registerProcessor({
      name: EMAIL_QUEUE_NAME,
      handler: async (data) => {
        const payload = data as EmailPayload;
        const result = await this.emailChannelService.send(payload);
        if (!result.success) {
          throw new Error(`Email delivery failed: ${result.error}`);
        }
      },
    });

    this.queueService.registerProcessor({
      name: WHATSAPP_QUEUE_NAME,
      handler: async (data) => {
        const payload = data as WhatsAppPayload;
        const result = await this.whatsAppChannelService.send(payload);
        if (!result.success) {
          throw new Error(`WhatsApp delivery failed: ${result.error}`);
        }
      },
    });

    // Register send_notification action with automations engine
    this.actionRegistry.register(this.sendNotificationAction);
  }
}
