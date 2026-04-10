import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { QueueService } from '@packages/queue';
import type { ChannelProvider, ChannelContext, NotificationChannel, RenderedNotification } from '../types';
import { ContactResolverRegistry } from './contact-resolver-registry';

export const EMAIL_QUEUE_NAME = 'notification.email';
export const WHATSAPP_QUEUE_NAME = 'notification.whatsapp';

@Injectable()
export class NotificationDispatcher {
  private readonly logger: ContextLogger;
  private readonly inlineChannels = new Map<NotificationChannel, ChannelProvider>();

  constructor(
    private readonly queueService: QueueService,
    private readonly contactResolverRegistry: ContactResolverRegistry,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(NotificationDispatcher.name);
  }

  /**
   * Register an inline channel (e.g., in_app) that processes synchronously.
   * Queued channels (email, whatsapp) are handled directly by the dispatcher.
   */
  registerInlineChannel(provider: ChannelProvider): void {
    this.inlineChannels.set(provider.channel, provider);
    this.logger.log(`Registered inline notification channel: ${provider.channel}`);
  }

  async dispatch(
    channel: NotificationChannel,
    recipientId: string,
    content: RenderedNotification,
    context: ChannelContext,
  ): Promise<void> {
    try {
      switch (channel) {
        case 'in_app': {
          const provider = this.inlineChannels.get('in_app');
          if (!provider) {
            this.logger.warn('No in_app channel registered — skipping');
            return;
          }
          await provider.send(recipientId, content, context);
          break;
        }

        case 'email': {
          const to = await this.contactResolverRegistry.resolve('email', recipientId);
          if (!to) {
            this.logger.warn('No email found for recipient — skipping', { recipientId, eventName: context.eventName });
            return;
          }
          await this.queueService.enqueue(EMAIL_QUEUE_NAME, {
            to,
            subject: content.subject ?? content.title,
            body: content.body,
            correlationId: context.correlationId,
          });
          this.logger.debug('Email notification enqueued', { channel, recipientId, to, eventName: context.eventName });
          break;
        }

        case 'whatsapp': {
          const to = await this.contactResolverRegistry.resolve('whatsapp', recipientId);
          if (!to) {
            this.logger.warn('No phone found for recipient — skipping', { recipientId, eventName: context.eventName });
            return;
          }
          await this.queueService.enqueue(WHATSAPP_QUEUE_NAME, {
            to,
            body: content.body,
            correlationId: context.correlationId,
          });
          this.logger.debug('WhatsApp notification enqueued', { channel, recipientId, to, eventName: context.eventName });
          break;
        }

        default:
          this.logger.warn(`Unknown channel "${channel}" — skipping`);
      }
    } catch (error) {
      this.logger.error('Failed to dispatch notification', {
        channel,
        recipientId,
        eventName: context.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
