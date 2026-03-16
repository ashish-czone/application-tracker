import { Injectable, Logger } from '@nestjs/common';
import type { ChannelProvider, ChannelContext, NotificationChannel, RenderedNotification } from '../types';

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private readonly channels = new Map<NotificationChannel, ChannelProvider>();

  registerChannel(provider: ChannelProvider): void {
    this.channels.set(provider.channel, provider);
    this.logger.log(`Registered notification channel: ${provider.channel}`);
  }

  async dispatch(
    channel: NotificationChannel,
    recipientId: string,
    content: RenderedNotification,
    context: ChannelContext,
  ): Promise<void> {
    const provider = this.channels.get(channel);
    if (!provider) {
      this.logger.warn(`No provider registered for channel "${channel}" — skipping`);
      return;
    }

    try {
      await provider.send(recipientId, content, context);
    } catch (error) {
      this.logger.error({
        channel,
        recipientId,
        eventName: context.eventName,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to dispatch notification');
    }
  }
}
