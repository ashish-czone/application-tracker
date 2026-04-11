import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, eq, and, isNull, sql, lte } from '@packages/database';
import { QueueService } from '@packages/queue';
import { todayInTimezone } from '@packages/common';
import { isPayloadCondition } from '@packages/common';
import type { DomainEvent } from '@packages/events';
import type { Condition } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { AUTOMATION_EXECUTION_QUEUE } from '../automations.module';
import { automationScheduled } from '../schema/automation-scheduled';
import { automationSentLog } from '../schema/automation-sent-log';
import { AutomationRuleService } from './automation-rule.service';
import { EntityResolverRegistry } from '@packages/automation-contracts';
import { buildConditions } from '../helpers/condition-builder';
import type { AutomationRule, ScheduleDateOperator, ScheduleUnit } from '@packages/automation-contracts';

@Injectable()
export class ScheduleScanner {
  private readonly logger: ContextLogger;
  private readonly appTimezone: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly ruleService: AutomationRuleService,
    private readonly queueService: QueueService,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ScheduleScanner.name);
    this.appTimezone = process.env.APP_TIMEZONE ?? 'UTC';
  }

  async scan(): Promise<void> {
    this.logger.log('Starting automation schedule scan');

    try {
      await this.processDelayedEvents();
      await this.processScheduleRules();
    } catch (error) {
      this.logger.error('Schedule scan error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.logger.log('Automation schedule scan complete');
  }

  /**
   * Process automation_scheduled rows where scheduled_for <= now AND sent_at IS NULL.
   * These are delayed event-triggered automations.
   */
  private async processDelayedEvents(): Promise<void> {
    const pending = await this.database.db
      .select()
      .from(automationScheduled)
      .where(withTenant(
        automationScheduled,
        lte(automationScheduled.scheduledFor, new Date()),
        isNull(automationScheduled.sentAt),
      ));

    if (pending.length === 0) return;

    this.logger.log(`Processing ${pending.length} delayed automation(s)`);

    for (const scheduled of pending) {
      try {
        const rule = await this.ruleService.findByIdOrFail(scheduled.ruleId).catch(() => null);
        if (!rule || !rule.isActive) {
          await this.markSent(scheduled.id);
          continue;
        }

        // Re-check state conditions against current entity data
        if (!await this.checkEntityConditions(rule, scheduled.entityType, scheduled.entityId)) {
          await this.markSent(scheduled.id);
          continue;
        }

        // Build synthetic event from stored payload
        const storedPayload = scheduled.eventPayload as Record<string, unknown>;
        const event: DomainEvent = {
          eventName: storedPayload?.eventName as string ?? '',
          entityType: scheduled.entityType,
          entityId: scheduled.entityId,
          actorId: storedPayload?.actorId as string ?? null,
          correlationId: storedPayload?.correlationId as string ?? '',
          occurredAt: scheduled.createdAt.toISOString(),
          payload: storedPayload?.payload as Record<string, unknown> ?? {},
        };

        await this.queueService.enqueue(AUTOMATION_EXECUTION_QUEUE, {
          ruleId: rule.id,
          event,
        });
        await this.markSent(scheduled.id);
      } catch (error) {
        this.logger.error('Error processing delayed automation', {
          scheduledId: scheduled.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Evaluate schedule_once and schedule_recurring rules against live entity data.
   * For each matching entity, fire the rule's actions.
   */
  private async processScheduleRules(): Promise<void> {
    const rules = await this.ruleService.findActiveScheduleRules();
    if (rules.length === 0) return;

    for (const rule of rules) {
      try {
        await this.evaluateScheduleRule(rule);
      } catch (error) {
        this.logger.error('Error evaluating schedule rule', {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async evaluateScheduleRule(rule: AutomationRule): Promise<void> {
    if (!rule.scheduleEntityType) return;

    // Check day-of-week filter for recurring rules
    if (rule.scheduleDaysOfWeek && rule.scheduleDaysOfWeek.length > 0) {
      const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: this.appTimezone });
      const dayName = formatter.format(new Date());
      const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const currentDay = dayMap[dayName] ?? new Date().getDay();

      if (!rule.scheduleDaysOfWeek.includes(currentDay)) return;
    }

    const entityResolver = this.entityResolverRegistry.get(rule.scheduleEntityType);
    if (!entityResolver) {
      this.logger.warn(`No entity resolver for "${rule.scheduleEntityType}" — skipping rule ${rule.id}`);
      return;
    }

    const amounts = rule.scheduleDateAmounts;
    const hasDateConfig = rule.scheduleDateField && rule.scheduleDateOperator && amounts && amounts.length > 0 && rule.scheduleDateUnit;

    // Build select columns
    const idColumn = (entityResolver.table as Record<string, any>).id;
    const selectColumns: Record<string, any> = { id: idColumn };
    for (const fieldName of Object.keys(entityResolver.fields)) {
      const col = (entityResolver.table as Record<string, any>)[fieldName];
      if (col) selectColumns[fieldName] = col;
    }
    for (const fieldName of Object.keys(entityResolver.userFields)) {
      const col = (entityResolver.table as Record<string, any>)[fieldName];
      if (col) selectColumns[fieldName] = col;
    }

    // Base conditions
    const baseConditions: any[] = [];
    if (rule.conditions && rule.conditions.length > 0) {
      const sqlConditions = rule.conditions.filter((c) => !isPayloadCondition(c));
      baseConditions.push(...buildConditions(entityResolver.table, sqlConditions, Object.keys(entityResolver.fields)));
    }

    const today = todayInTimezone(this.appTimezone);
    const targetDate = rule.triggerType === 'schedule_once' ? '9999-12-31' : today;

    // Query entities for each offset, dedup, and fire actions
    const seenEntityIds = new Set<string>();
    const matchedEntities: Array<Record<string, unknown> & { id: string }> = [];

    const offsetsToQuery = hasDateConfig ? amounts : [0];
    for (const amount of offsetsToQuery) {
      const conditions = [...baseConditions];

      if (hasDateConfig) {
        const dateCondition = this.buildDateCondition(
          entityResolver.table,
          rule.scheduleDateField!,
          rule.scheduleDateOperator as ScheduleDateOperator,
          amount,
          rule.scheduleDateUnit as ScheduleUnit,
          rule.triggerType === 'schedule_once',
        );
        if (dateCondition) conditions.push(dateCondition);
      }

      const entities = await this.database.db
        .select(selectColumns)
        .from(entityResolver.table)
        .where(withTenant(entityResolver.table as any, ...(conditions.length > 0 ? conditions : [])));

      for (const entity of entities) {
        const entityId = (entity as Record<string, any>).id as string;
        if (seenEntityIds.has(entityId)) continue;
        seenEntityIds.add(entityId);

        const alreadySent = await this.checkSentLog(rule.id, rule.scheduleEntityType!, entityId, targetDate);
        if (alreadySent) continue;

        matchedEntities.push(entity as Record<string, unknown> & { id: string });
      }
    }

    if (matchedEntities.length === 0) return;

    // Enqueue a job per matched entity for parallel execution via Bull workers
    for (const entity of matchedEntities) {
      const syntheticEvent: DomainEvent = {
        eventName: `schedule.${rule.scheduleEntityType}`,
        entityType: rule.scheduleEntityType!,
        entityId: entity.id,
        actorId: null,
        correlationId: `schedule-${rule.id}-${entity.id}`,
        occurredAt: new Date().toISOString(),
        payload: entity as Record<string, unknown>,
      };

      await this.queueService.enqueue(AUTOMATION_EXECUTION_QUEUE, {
        ruleId: rule.id,
        event: syntheticEvent,
      });
      await this.logSent(rule.id, rule.scheduleEntityType!, entity.id, targetDate);
    }
  }

  private async checkEntityConditions(rule: AutomationRule, entityType: string, entityId: string): Promise<boolean> {
    if (!rule.conditions || rule.conditions.length === 0) return true;

    const sqlConditions = rule.conditions.filter((c) => !isPayloadCondition(c));
    if (sqlConditions.length === 0) return true;

    const entityResolver = this.entityResolverRegistry.get(entityType);
    if (!entityResolver) return true;

    const conditionSql = buildConditions(entityResolver.table, sqlConditions, Object.keys(entityResolver.fields));
    if (conditionSql.length === 0) return true;

    const idColumn = (entityResolver.table as Record<string, any>).id;
    const [entity] = await this.database.db
      .select({ id: idColumn })
      .from(entityResolver.table)
      .where(withTenant(entityResolver.table as any, eq(idColumn, entityId), ...conditionSql))
      .limit(1);

    return !!entity;
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

    const interval = this.makeInterval(amount, unit);
    const tz = this.appTimezone;

    if (operator === 'before') {
      if (exactMatch) {
        return sql`DATE(${column} - ${interval}) = (NOW() AT TIME ZONE ${tz})::date`;
      }
      return sql`${column} - ${interval} <= (NOW() AT TIME ZONE ${tz})`;
    }

    if (exactMatch) {
      return sql`DATE(${column} + ${interval}) = (NOW() AT TIME ZONE ${tz})::date`;
    }
    return sql`${column} + ${interval} <= (NOW() AT TIME ZONE ${tz})`;
  }

  private makeInterval(amount: number, unit: ScheduleUnit) {
    switch (unit) {
      case 'minutes': return sql`make_interval(mins => ${amount})`;
      case 'hours': return sql`make_interval(hours => ${amount})`;
      case 'days': return sql`make_interval(days => ${amount})`;
    }
  }

  async deletePendingForEntity(entityType: string, entityId: string, tx?: any): Promise<void> {
    const db = tx ?? this.database.db;
    await db
      .delete(automationScheduled)
      .where(withTenant(
        automationScheduled,
        eq(automationScheduled.entityType, entityType),
        eq(automationScheduled.entityId, entityId),
        isNull(automationScheduled.sentAt),
      ));
  }

  private async markSent(scheduledId: string): Promise<void> {
    await this.database.db
      .update(automationScheduled)
      .set({ sentAt: new Date() })
      .where(withTenant(automationScheduled, eq(automationScheduled.id, scheduledId)));
  }

  private async checkSentLog(ruleId: string, entityType: string, entityId: string, targetDate: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ ruleId: automationSentLog.ruleId })
      .from(automationSentLog)
      .where(withTenant(
        automationSentLog,
        eq(automationSentLog.ruleId, ruleId),
        eq(automationSentLog.entityType, entityType),
        eq(automationSentLog.entityId, entityId),
        eq(automationSentLog.targetDate, targetDate),
      ))
      .limit(1);

    return !!row;
  }

  private async logSent(ruleId: string, entityType: string, entityId: string, targetDate: string): Promise<void> {
    await this.database.db
      .insert(automationSentLog)
      .values(withTenantInsert(automationSentLog, { ruleId, entityType, entityId, targetDate }))
      .onConflictDoNothing();
  }
}
