import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService, eq, and } from '@packages/database';
import type { DomainEvent } from '@packages/events';
import { NotificationRuleService } from '../services/notification-rule.service';
import { RecipientResolver } from '../services/recipient-resolver';
import { PreferenceService } from '../services/preference.service';
import { TemplateRenderer } from '../services/template-renderer';
import { NotificationDispatcher } from '../services/notification-dispatcher';
import { EntityResolverRegistry } from '../services/entity-resolver-registry';
import { buildConditions } from '../helpers/condition-builder';
import { notificationScheduled } from '../schema/notification-scheduled';
import type { ScheduleUnit, Condition } from '../types';

@Injectable()
export class NotificationListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly ruleService: NotificationRuleService,
    private readonly recipientResolver: RecipientResolver,
    private readonly preferenceService: PreferenceService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly dispatcher: NotificationDispatcher,
    private readonly database: DatabaseService,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(NotificationListener.name);
  }

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

        // Check conditions against the entity before dispatching
        if (rule.conditions && (rule.conditions as Condition[]).length > 0) {
          const entityResolver = this.entityResolverRegistry.get(event.entityType);
          if (entityResolver) {
            const conditionSql = buildConditions(
              entityResolver.table,
              rule.conditions as Condition[],
              Object.keys(entityResolver.fields),
            );
            const idColumn = (entityResolver.table as Record<string, any>).id;
            const [entity] = await this.database.db
              .select({ id: idColumn })
              .from(entityResolver.table)
              .where(and(eq(idColumn, event.entityId), ...conditionSql))
              .limit(1);

            if (!entity) continue; // Entity doesn't match conditions — skip rule
          }
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
      this.logger.error('Notification listener error', {
        eventName: event.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
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

    this.logger.debug('Delayed notification scheduled', {
      ruleId,
      entityId: event.entityId,
      scheduledFor: scheduledFor.toISOString(),
    });
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
