import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { notifications } from '../schema/notifications';
import type { ChannelProvider, ChannelContext, RenderedNotification, NotificationChannel } from '../types';

@Injectable()
export class InAppChannel implements ChannelProvider {
  readonly channel: NotificationChannel = 'in_app';
  private readonly logger = new Logger(InAppChannel.name);

  constructor(private readonly database: DatabaseService) {}

  async send(recipientId: string, content: RenderedNotification, context: ChannelContext): Promise<void> {
    await this.database.db
      .insert(notifications)
      .values({
        userId: recipientId,
        title: content.title,
        body: content.body,
        eventName: context.eventName,
        entityType: context.entityType,
        entityId: context.entityId,
      });

    this.logger.debug({
      channel: this.channel,
      recipientId,
      eventName: context.eventName,
    }, 'In-app notification created');
  }
}
