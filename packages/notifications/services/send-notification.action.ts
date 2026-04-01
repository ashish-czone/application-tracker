import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, eq } from '@packages/database';
import type { ActionHandler, ActionContext, ActionResult, UserSlotDefinition } from '@packages/automations';
import { notificationTemplates } from '../schema/notification-templates';
import { NotificationDispatcher } from './notification-dispatcher';
import { TemplateRenderer } from './template-renderer';
import { PreferenceService } from './preference.service';
import type { NotificationChannel, NotificationTemplate } from '../types';

interface ChannelConfig {
  channel: NotificationChannel;
  templateId: string;
}

@Injectable()
export class SendNotificationAction implements ActionHandler {
  readonly type = 'send_notification';
  readonly label = 'Send Notification';
  readonly userSlots: UserSlotDefinition[] = [
    { name: 'recipient', label: 'Send To', required: true },
  ];
  readonly configSchema = {
    channels: {
      type: 'array',
      required: true,
      label: 'Notification Channels',
      items: {
        channel: { type: 'enum', options: ['email', 'in_app', 'whatsapp'], label: 'Channel' },
        templateId: { type: 'string', label: 'Template' },
      },
    },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly templateRenderer: TemplateRenderer,
    private readonly preferenceService: PreferenceService,
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(SendNotificationAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const channels = context.actionConfig.config.channels as ChannelConfig[] | undefined;
    if (!channels || channels.length === 0) {
      this.logger.warn(`No channels configured for send_notification action in rule ${context.rule.id}`);
      return {};
    }

    const recipients = context.resolvedUsers.recipient ?? [];
    if (recipients.length === 0) {
      this.logger.debug('No recipients resolved — skipping notification');
      return {};
    }

    const channelContext = {
      eventName: context.event?.eventName ?? '',
      entityType: context.event?.entityType ?? '',
      entityId: context.event?.entityId ?? '',
      correlationId: context.event?.correlationId ?? '',
    };

    for (const channelConfig of channels) {
      const template = await this.loadTemplate(channelConfig.templateId);
      if (!template) {
        this.logger.warn(`Template ${channelConfig.templateId} not found — skipping channel ${channelConfig.channel}`);
        continue;
      }

      // Build a synthetic DomainEvent for the template renderer
      const syntheticEvent = {
        eventName: context.event?.eventName ?? '',
        entityType: context.event?.entityType ?? '',
        entityId: context.event?.entityId ?? '',
        actorId: context.event?.actorId ?? null,
        correlationId: context.event?.correlationId ?? '',
        occurredAt: new Date().toISOString(),
        payload: context.event?.payload ?? {},
      };

      const content = this.templateRenderer.render(template, syntheticEvent);

      for (const recipientId of recipients) {
        const enabled = await this.preferenceService.isEnabled(recipientId, channelConfig.channel);
        if (!enabled) continue;

        await this.dispatcher.dispatch(channelConfig.channel, recipientId, content, channelContext);
      }
    }

    return {};
  }

  private async loadTemplate(templateId: string): Promise<NotificationTemplate | null> {
    const [row] = await this.database.db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, templateId))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      channel: row.channel as NotificationChannel,
      subject: row.subject,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
