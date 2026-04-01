import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, eq, and } from '@packages/database';
import type { DomainEvent } from '@packages/events';
import {
  isPayloadCondition,
  evaluatePayloadConditions,
  evaluateConditionsInMemory,
  type Condition,
} from '@packages/common';
import { AutomationRuleService } from '../services/automation-rule.service';
import { ActionRegistry } from '../services/action-registry';
import { UserResolverRegistry } from '../services/user-resolver-registry';
import { EntityResolverRegistry } from '../services/entity-resolver-registry';
import { buildConditions } from '../helpers/condition-builder';
import { automationScheduled } from '../schema/automation-scheduled';
import type { AutomationRule, ActionConfig, ScheduleUnit } from '../types';

@Injectable()
export class AutomationListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly ruleService: AutomationRuleService,
    private readonly actionRegistry: ActionRegistry,
    private readonly userResolverRegistry: UserResolverRegistry,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(AutomationListener.name);
  }

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      const rules = await this.ruleService.findActiveByEventName(event.eventName);
      if (rules.length === 0) return;

      for (const rule of rules) {
        await this.processRule(rule, event);
      }
    } catch (error) {
      this.logger.error('Automation listener error', {
        eventName: event.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processRule(rule: AutomationRule, event: DomainEvent): Promise<void> {
    // Delayed rule → store for later processing
    if (rule.delayAmount && rule.delayUnit) {
      await this.scheduleDelayed(rule.id, event, rule.delayAmount, rule.delayUnit);
      return;
    }

    // Evaluate conditions
    if (!this.evaluateConditions(rule, event)) return;

    // Execute all actions
    await this.executeActions(rule, event);
  }

  private evaluateConditions(rule: AutomationRule, event: DomainEvent): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;

    const conditions = rule.conditions;

    // 1. Evaluate payload conditions (changed, changed_to, changed_from_to)
    const payloadConds = conditions.filter(isPayloadCondition);
    if (payloadConds.length > 0) {
      const payloadMatch = evaluatePayloadConditions(payloadConds, event.payload as {
        changes?: string[];
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
      });
      if (!payloadMatch) return false;
    }

    // 2. Evaluate state conditions
    const stateConds = conditions.filter((c) => !isPayloadCondition(c));
    if (stateConds.length > 0) {
      const payload = event.payload as Record<string, unknown> | undefined;
      const afterData = payload?.after as Record<string, unknown> | undefined;

      if (afterData) {
        if (!evaluateConditionsInMemory(stateConds, afterData)) return false;
      }
      // DB-based condition evaluation is handled by schedule scanner and
      // lifecycle engine — the event listener evaluates against payload only
    }

    return true;
  }

  async executeActions(rule: AutomationRule, event: DomainEvent): Promise<void> {
    for (let i = 0; i < rule.actions.length; i++) {
      const actionConfig = rule.actions[i];
      const handler = this.actionRegistry.get(actionConfig.type);

      if (!handler) {
        this.logger.warn(`No handler for action type "${actionConfig.type}" in rule ${rule.id}`);
        continue;
      }

      // Resolve users for this action
      const resolvedUsers = actionConfig.users
        ? await this.userResolverRegistry.resolveAll(actionConfig.users, {
            event: {
              actorId: event.actorId,
              entityType: event.entityType,
              entityId: event.entityId,
              payload: event.payload as Record<string, unknown>,
            },
          })
        : {};

      try {
        await handler.execute({
          rule,
          actionIndex: i,
          actionConfig,
          event: {
            eventName: event.eventName,
            entityType: event.entityType,
            entityId: event.entityId,
            actorId: event.actorId,
            correlationId: event.correlationId,
            payload: event.payload as Record<string, unknown>,
          },
          resolvedUsers,
        });
      } catch (error) {
        this.logger.error(`Action "${actionConfig.type}" failed for rule ${rule.id}`, {
          actionIndex: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
      .insert(automationScheduled)
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

    this.logger.debug('Delayed automation scheduled', {
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
