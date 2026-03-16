import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '@packages/queue';
import type { ChannelProvider, ChannelContext, RenderedNotification, NotificationChannel } from '../types';

export const WHATSAPP_QUEUE_NAME = 'notification.whatsapp';

@Injectable()
export class WhatsAppChannel implements ChannelProvider {
  readonly channel: NotificationChannel = 'whatsapp';
  private readonly logger = new Logger(WhatsAppChannel.name);

  constructor(private readonly queueService: QueueService) {}

  async send(recipientId: string, content: RenderedNotification, context: ChannelContext): Promise<void> {
    await this.queueService.enqueue(WHATSAPP_QUEUE_NAME, {
      recipientId,
      body: content.body,
      correlationId: context.correlationId,
    });

    this.logger.debug({
      channel: this.channel,
      recipientId,
      eventName: context.eventName,
    }, 'WhatsApp notification enqueued');
  }
}
