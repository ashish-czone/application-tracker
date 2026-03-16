import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '@packages/events';
import { NotificationRuleService } from '../services/notification-rule.service';
import { RecipientResolver } from '../services/recipient-resolver';
import { PreferenceService } from '../services/preference.service';
import { TemplateRenderer } from '../services/template-renderer';
import { NotificationDispatcher } from '../services/notification-dispatcher';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly ruleService: NotificationRuleService,
    private readonly recipientResolver: RecipientResolver,
    private readonly preferenceService: PreferenceService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      const rules = await this.ruleService.findActiveByEventName(event.eventName);
      if (rules.length === 0) return;

      for (const rule of rules) {
        const recipients = await this.recipientResolver.resolve(rule, event);
        if (recipients.length === 0) continue;

        for (const ruleChannel of rule.channels) {
          const context = {
            eventName: event.eventName,
            entityType: event.entityType,
            entityId: event.entityId,
            correlationId: event.correlationId,
          };

          const content = this.templateRenderer.render(ruleChannel.template, event);

          for (const recipientId of recipients) {
            const enabled = await this.preferenceService.isEnabled(recipientId, ruleChannel.channel);
            if (!enabled) continue;

            await this.dispatcher.dispatch(ruleChannel.channel, recipientId, content, context);
          }
        }
      }
    } catch (error) {
      // Never let notification failures crash the process
      this.logger.error({
        eventName: event.eventName,
        error: error instanceof Error ? error.message : String(error),
      }, 'Notification listener error');
    }
  }
}
