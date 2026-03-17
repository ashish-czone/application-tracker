import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService, eq, and, isNull, sql, lte } from '@packages/database';
import { notificationRules } from '../schema/notification-rules';
import { notificationScheduled } from '../schema/notification-scheduled';
import { notificationSentLog } from '../schema/notification-sent-log';
import { EntityResolverRegistry } from './entity-resolver-registry';
import { NotificationRuleService, type RuleWithChannels } from './notification-rule.service';
import { RecipientResolver } from './recipient-resolver';
import { PreferenceService } from './preference.service';
import { TemplateRenderer } from './template-renderer';
import { NotificationDispatcher } from './notification-dispatcher';
import { buildConditions } from '../helpers/condition-builder';
import type { Condition, NotificationRule, ScheduleDateOperator, ScheduleUnit } from '../types';
import type { DomainEvent } from '@packages/events';

@Injectable()
export class ScheduleScanner {
  private readonly logger = new Logger(ScheduleScanner.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly ruleService: NotificationRuleService,
    private readonly recipientResolver: RecipientResolver,
    private readonly preferenceService: PreferenceService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  /**
   * Main scan method — called by the hourly cron job.
   * 1. Process pending delayed-event notifications (notification_scheduled)
   * 2. Evaluate schedule_once + schedule_recurring rules against live entities
   */
  async scan(): Promise<void> {
    this.logger.log('Starting notification schedule scan');

    try {
      await this.processDelayedEvents();
      await this.processScheduleRules();
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Schedule scan error');
    }

    this.logger.log('Notification schedule scan complete');
  }

  /**
   * Process notification_scheduled rows where scheduled_for <= now AND sent_at IS NULL.
   * These are delayed event notifications.
   */
  private async processDelayedEvents(): Promise<void> {
    const pending = await this.database.db
      .select()
      .from(notificationScheduled)
      .where(and(
        lte(notificationScheduled.scheduledFor, new Date()),
        isNull(notificationScheduled.sentAt),
      ));

    if (pending.length === 0) return;

    this.logger.log(`Processing ${pending.length} delayed event notification(s)`);

    for (const scheduled of pending) {
      try {
        // Load the rule with channels
        const rules = await this.ruleService.findActiveByEventName(
          (scheduled.eventPayload as Record<string, unknown>)?.eventName as string ?? '',
        );
        const rule = rules.find((r) => r.id === scheduled.ruleId);
        if (!rule) {
          await this.markSent(scheduled.id);
          continue;
        }

        // Re-check conditions if configured
        if (rule.conditions && (rule.conditions as Condition[]).length > 0) {
          const entityResolver = this.entityResolverRegistry.get(scheduled.entityType);
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
              .where(and(eq(idColumn, scheduled.entityId), ...conditionSql))
              .limit(1);

            if (!entity) {
              await this.markSent(scheduled.id);
              continue;
            }
          }
        }

        // Build a synthetic event from stored payload for template rendering
        const event: DomainEvent = {
          eventName: (scheduled.eventPayload as Record<string, unknown>)?.eventName as string ?? '',
          entityType: scheduled.entityType,
          entityId: scheduled.entityId,
          actorId: (scheduled.eventPayload as Record<string, unknown>)?.actorId as string ?? null,
          correlationId: (scheduled.eventPayload as Record<string, unknown>)?.correlationId as string ?? '',
          occurredAt: scheduled.createdAt.toISOString(),
          payload: (scheduled.eventPayload as Record<string, unknown>)?.payload as Record<string, unknown> ?? {},
        };

        await this.dispatchForRule(rule, event);
        await this.markSent(scheduled.id);
      } catch (error) {
        this.logger.error({
          scheduledId: scheduled.id,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error processing delayed notification');
      }
    }
  }

  /**
   * Evaluate schedule_once and schedule_recurring rules against live entity data.
   */
  private async processScheduleRules(): Promise<void> {
    const scheduleRules = await this.database.db
      .select()
      .from(notificationRules)
      .where(and(
        eq(notificationRules.isActive, true),
        sql`${notificationRules.triggerType} IN ('schedule_once', 'schedule_recurring')`,
      ));

    if (scheduleRules.length === 0) return;

    for (const rule of scheduleRules) {
      try {
        await this.evaluateScheduleRule(rule as unknown as NotificationRule);
      } catch (error) {
        this.logger.error({
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error evaluating schedule rule');
      }
    }
  }

  private async evaluateScheduleRule(rule: NotificationRule): Promise<void> {
    if (!rule.scheduleEntityType) return;

    const entityResolver = this.entityResolverRegistry.get(rule.scheduleEntityType);
    if (!entityResolver) {
      this.logger.warn(`No entity resolver registered for "${rule.scheduleEntityType}" — skipping rule ${rule.id}`);
      return;
    }

    // Build query conditions
    const conditions = [];

    // User-defined conditions from JSON
    if (rule.conditions && (rule.conditions as Condition[]).length > 0) {
      conditions.push(...buildConditions(entityResolver.table, rule.conditions as Condition[], Object.keys(entityResolver.fields)));
    }

    // Date-based condition (uses first amount for now; multi-offset aggregation in next task)
    const amounts = rule.scheduleDateAmounts;
    if (rule.scheduleDateField && rule.scheduleDateOperator && amounts && amounts.length > 0 && rule.scheduleDateUnit) {
      const dateCondition = this.buildDateCondition(
        entityResolver.table,
        rule.scheduleDateField,
        rule.scheduleDateOperator as ScheduleDateOperator,
        amounts[0],
        rule.scheduleDateUnit as ScheduleUnit,
        rule.triggerType === 'schedule_once',
      );
      if (dateCondition) conditions.push(dateCondition);
    }

    // Build select columns from registered fields + recipient fields + id
    const idColumn = (entityResolver.table as Record<string, any>).id;
    const selectColumns: Record<string, any> = { id: idColumn };
    for (const fieldName of Object.keys(entityResolver.fields)) {
      const col = (entityResolver.table as Record<string, any>)[fieldName];
      if (col) selectColumns[fieldName] = col;
    }
    for (const fieldName of Object.keys(entityResolver.recipientFields)) {
      const col = (entityResolver.table as Record<string, any>)[fieldName];
      if (col) selectColumns[fieldName] = col;
    }

    // Query matching entities with all registered fields
    const entities = await this.database.db
      .select(selectColumns)
      .from(entityResolver.table)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    if (entities.length === 0) return;

    // Load rule with channels
    const ruleWithChannels = await this.loadRuleWithChannels(rule.id);
    if (!ruleWithChannels || ruleWithChannels.channels.length === 0) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    for (const entity of entities) {
      // Dedup check
      const targetDate = rule.triggerType === 'schedule_once' ? '9999-12-31' : today;
      const alreadySent = await this.checkSentLog(rule.id, rule.scheduleEntityType, entity.id, targetDate);
      if (alreadySent) continue;

      // Build event-like context for rendering
      const event: DomainEvent = {
        eventName: `schedule.${rule.scheduleEntityType}`,
        entityType: rule.scheduleEntityType,
        entityId: entity.id,
        actorId: null,
        correlationId: `schedule-${rule.id}-${entity.id}`,
        occurredAt: new Date().toISOString(),
        payload: entity as Record<string, unknown>,
      };

      await this.dispatchForRule(ruleWithChannels, event);
      await this.logSent(rule.id, rule.scheduleEntityType, entity.id, targetDate);
    }
  }

  private buildDateCondition(
    table: any,
    dateField: string,
    operator: ScheduleDateOperator,
    amount: number,
    unit: ScheduleUnit,
    exactMatch: boolean,
  ) {
    const column = (table as Record<string, any>)[dateField];
    if (!column) return undefined;

    // Use make_interval() with parameterized values — no sql.raw(), no injection risk
    const interval = this.makeInterval(amount, unit);

    if (operator === 'before') {
      if (exactMatch) {
        return sql`DATE(${column} - ${interval}) = CURRENT_DATE`;
      }
      return sql`${column} - ${interval} <= NOW()`;
    }

    // after
    if (exactMatch) {
      return sql`DATE(${column} + ${interval}) = CURRENT_DATE`;
    }
    return sql`${column} + ${interval} <= NOW()`;
  }

  /**
   * Build a parameterized PostgreSQL interval using make_interval().
   * Avoids sql.raw() — all values are bound parameters.
   */
  private makeInterval(amount: number, unit: ScheduleUnit) {
    switch (unit) {
      case 'minutes': return sql`make_interval(mins => ${amount})`;
      case 'hours': return sql`make_interval(hours => ${amount})`;
      case 'days': return sql`make_interval(days => ${amount})`;
    }
  }

  private async dispatchForRule(rule: RuleWithChannels, event: DomainEvent): Promise<void> {
    const recipients = await this.recipientResolver.resolve(rule, event);
    if (recipients.length === 0) return;

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

  private async markSent(scheduledId: string): Promise<void> {
    await this.database.db
      .update(notificationScheduled)
      .set({ sentAt: new Date() })
      .where(eq(notificationScheduled.id, scheduledId));
  }

  private async checkSentLog(ruleId: string, entityType: string, entityId: string, targetDate: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ ruleId: notificationSentLog.ruleId })
      .from(notificationSentLog)
      .where(and(
        eq(notificationSentLog.ruleId, ruleId),
        eq(notificationSentLog.entityType, entityType),
        eq(notificationSentLog.entityId, entityId),
        eq(notificationSentLog.targetDate, targetDate),
      ))
      .limit(1);

    return !!row;
  }

  private async logSent(ruleId: string, entityType: string, entityId: string, targetDate: string): Promise<void> {
    await this.database.db
      .insert(notificationSentLog)
      .values({ ruleId, entityType, entityId, targetDate })
      .onConflictDoNothing();
  }

  private async loadRuleWithChannels(ruleId: string): Promise<RuleWithChannels | null> {
    return this.ruleService.findByIdWithChannels(ruleId);
  }
}
