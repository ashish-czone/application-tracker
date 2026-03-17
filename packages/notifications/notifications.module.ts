import { Module, type OnModuleInit, Logger } from '@nestjs/common';
import { QueueService } from '@packages/queue';
import { EmailChannelService, WhatsAppChannelService } from '@packages/notification-channels';
import type { EmailPayload, WhatsAppPayload } from '@packages/notification-channels';
import { NotificationRuleService } from './services/notification-rule.service';
import { NotificationRulesService } from './services/notification-rules.service';
import { NotificationTemplatesService } from './services/notification-templates.service';
import { RecipientResolver } from './services/recipient-resolver';
import { PreferenceService } from './services/preference.service';
import { TemplateRenderer } from './services/template-renderer';
import { NotificationDispatcher } from './services/notification-dispatcher';
import { NotificationListener } from './listeners/notification.listener';
import { EntityResolverRegistry } from './services/entity-resolver-registry';
import { ScheduleScanner } from './services/schedule-scanner';
import { InAppChannel } from './channels/in-app.channel';
import { EmailChannel, EMAIL_QUEUE_NAME } from './channels/email.channel';
import { WhatsAppChannel, WHATSAPP_QUEUE_NAME } from './channels/whatsapp.channel';

export const SCHEDULE_SCAN_QUEUE = 'notification.schedule-scan';

@Module({
  providers: [
    NotificationRuleService,
    NotificationRulesService,
    NotificationTemplatesService,
    RecipientResolver,
    PreferenceService,
    TemplateRenderer,
    NotificationDispatcher,
    NotificationListener,
    EntityResolverRegistry,
    ScheduleScanner,
    InAppChannel,
    EmailChannel,
    WhatsAppChannel,
  ],
  exports: [
    NotificationDispatcher,
    PreferenceService,
    NotificationRulesService,
    NotificationTemplatesService,
    EntityResolverRegistry,
  ],
})
export class NotificationsModule implements OnModuleInit {
  private readonly logger = new Logger(NotificationsModule.name);

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly inAppChannel: InAppChannel,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly queueService: QueueService,
    private readonly scheduleScanner: ScheduleScanner,
    private readonly emailChannelService: EmailChannelService,
    private readonly whatsAppChannelService: WhatsAppChannelService,
  ) {}

  onModuleInit() {
    // Register channel providers
    this.dispatcher.registerChannel(this.inAppChannel);
    this.dispatcher.registerChannel(this.emailChannel);
    this.dispatcher.registerChannel(this.whatsAppChannel);

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

    // Register hourly cron job for schedule scanner
    this.queueService.registerProcessor({
      name: SCHEDULE_SCAN_QUEUE,
      handler: async () => {
        await this.scheduleScanner.scan();
      },
    });

    // Enqueue repeatable scan — runs daily at 2:00 AM
    const queue = this.queueService.getQueue(SCHEDULE_SCAN_QUEUE);
    if (queue) {
      queue.upsertJobScheduler(
        'notification-schedule-scan',
        { pattern: '0 2 * * *' },
        { name: SCHEDULE_SCAN_QUEUE, data: {} },
      ).then(() => {
        this.logger.log('Notification schedule scanner registered (daily at 2:00 AM)');
      }).catch((err) => {
        this.logger.error({ error: err.message }, 'Failed to register schedule scanner');
      });
    }
  }
}
