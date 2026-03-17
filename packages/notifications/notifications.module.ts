import { Module, type OnModuleInit, Logger } from '@nestjs/common';
import { QueueService } from '@packages/queue';
import { cronForLocalHour } from '@packages/common';
import { EmailChannelService, WhatsAppChannelService } from '@packages/notification-channels';
import type { EmailPayload, WhatsAppPayload } from '@packages/notification-channels';
import { NotificationRuleService } from './services/notification-rule.service';
import { NotificationRulesService } from './services/notification-rules.service';
import { NotificationTemplatesService } from './services/notification-templates.service';
import { RecipientResolver } from './services/recipient-resolver';
import { PreferenceService } from './services/preference.service';
import { TemplateRenderer } from './services/template-renderer';
import { NotificationDispatcher, EMAIL_QUEUE_NAME, WHATSAPP_QUEUE_NAME } from './services/notification-dispatcher';
import { NotificationListener } from './listeners/notification.listener';
import { EntityResolverRegistry } from './services/entity-resolver-registry';
import { ContactResolverRegistry } from './services/contact-resolver-registry';
import { ScheduleScanner } from './services/schedule-scanner';
import { InAppChannel } from './channels/in-app.channel';

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
    ContactResolverRegistry,
    ScheduleScanner,
    InAppChannel,
  ],
  exports: [
    NotificationDispatcher,
    PreferenceService,
    NotificationRulesService,
    NotificationTemplatesService,
    EntityResolverRegistry,
    ContactResolverRegistry,
  ],
})
export class NotificationsModule implements OnModuleInit {
  private readonly logger = new Logger(NotificationsModule.name);

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly inAppChannel: InAppChannel,
    private readonly queueService: QueueService,
    private readonly scheduleScanner: ScheduleScanner,
    private readonly emailChannelService: EmailChannelService,
    private readonly whatsAppChannelService: WhatsAppChannelService,
  ) {}

  onModuleInit() {
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

    // Register hourly cron job for schedule scanner
    this.queueService.registerProcessor({
      name: SCHEDULE_SCAN_QUEUE,
      handler: async () => {
        await this.scheduleScanner.scan();
      },
    });

    // Enqueue repeatable scan — runs daily at 2:00 AM in the app timezone
    const queue = this.queueService.getQueue(SCHEDULE_SCAN_QUEUE);
    if (queue) {
      const appTimezone = process.env.APP_TIMEZONE ?? 'UTC';
      const cronPattern = cronForLocalHour(2, appTimezone);
      queue.upsertJobScheduler(
        'notification-schedule-scan',
        { pattern: cronPattern },
        { name: SCHEDULE_SCAN_QUEUE, data: {} },
      ).then(() => {
        this.logger.log(`Notification schedule scanner registered (${cronPattern}, 2:00 AM ${process.env.APP_TIMEZONE ?? 'UTC'})`);
      }).catch((err) => {
        this.logger.error({ error: err.message }, 'Failed to register schedule scanner');
      });
    }
  }
}
