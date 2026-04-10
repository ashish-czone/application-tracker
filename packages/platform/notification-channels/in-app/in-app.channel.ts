import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { withTenantInsert } from '@packages/tenancy/helpers';
import { notifications } from '../schema/notifications';
import type { ChannelProvider, ChannelContext, RenderedNotification, NotificationChannel } from '../types';

@Injectable()
export class InAppChannel implements ChannelProvider {
  readonly channel: NotificationChannel = 'in_app';
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(InAppChannel.name);
  }

  async send(recipientId: string, content: RenderedNotification, context: ChannelContext): Promise<void> {
    await this.database.db
      .insert(notifications)
      .values(withTenantInsert(notifications, {
        userId: recipientId,
        title: content.title,
        body: content.body,
        eventName: context.eventName,
        entityType: context.entityType,
        entityId: context.entityId,
      }));

    this.logger.debug('In-app notification created', {
      channel: this.channel,
      recipientId,
      eventName: context.eventName,
    });
  }
}
