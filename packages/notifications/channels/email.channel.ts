import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '@packages/queue';
import type { ChannelProvider, ChannelContext, RenderedNotification, NotificationChannel } from '../types';

export const EMAIL_QUEUE_NAME = 'notification.email';

@Injectable()
export class EmailChannel implements ChannelProvider {
  readonly channel: NotificationChannel = 'email';
  private readonly logger = new Logger(EmailChannel.name);

  constructor(private readonly queueService: QueueService) {}

  async send(recipientId: string, content: RenderedNotification, context: ChannelContext): Promise<void> {
    await this.queueService.enqueue(EMAIL_QUEUE_NAME, {
      recipientId,
      subject: content.subject ?? content.title,
      body: content.body,
      correlationId: context.correlationId,
    });

    this.logger.debug({
      channel: this.channel,
      recipientId,
      eventName: context.eventName,
    }, 'Email notification enqueued');
  }
}
