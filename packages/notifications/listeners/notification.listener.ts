import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '@packages/database';
import type { DomainEvent } from '@packages/events';
import { NotificationRuleService } from '../services/notification-rule.service';
import { RecipientResolver } from '../services/recipient-resolver';
import { PreferenceService } from '../services/preference.service';
import { TemplateRenderer } from '../services/template-renderer';
import { NotificationDispatcher } from '../services/notification-dispatcher';
import { notificationScheduled } from '../schema/notification-scheduled';
import type { ScheduleUnit } from '../types';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly ruleService: NotificationRuleService,
    private readonly recipientResolver: RecipientResolver,
    private readonly preferenceService: PreferenceService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly dispatcher: NotificationDispatcher,
    private readonly database: DatabaseService,
  ) {}

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      const rules = await this.ruleService.findActiveByEventName(event.eventName);
      if (rules.length === 0) return;

      for (const rule of rules) {
        // Delayed event rule → store in notification_scheduled for cron scanner
        if (rule.delayAmount && rule.delayUnit) {
          await this.scheduleDelayed(rule.id, event, rule.delayAmount, rule.delayUnit as ScheduleUnit);
          continue;
        }

        // Immediate event rule → dispatch now
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

  private async scheduleDelayed(
    ruleId: string,
    event: DomainEvent,
    delayAmount: number,
    delayUnit: ScheduleUnit,
  ): Promise<void> {
    const scheduledFor = this.calculateScheduledFor(new Date(), delayAmount, delayUnit);

    await this.database.db
      .insert(notificationScheduled)
      .values({
        ruleId,
        entityType: event.entityType,
        entityId: event.entityId,
        eventPayload: {
          eventName: event.eventName,
          actorId: event.actorId,
          correlationId: event.correlationId,
          payload: event.payload,
        },
        scheduledFor,
      });

    this.logger.debug({
      ruleId,
      entityId: event.entityId,
      scheduledFor: scheduledFor.toISOString(),
    }, 'Delayed notification scheduled');
  }

  private calculateScheduledFor(from: Date, amount: number, unit: ScheduleUnit): Date {
    const date = new Date(from);
    switch (unit) {
      case 'minutes': date.setMinutes(date.getMinutes() + amount); break;
      case 'hours': date.setHours(date.getHours() + amount); break;
      case 'days': date.setDate(date.getDate() + amount); break;
    }
    return date;
  }
}
