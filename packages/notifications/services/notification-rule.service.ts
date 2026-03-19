import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, and } from '@packages/database';
import { notificationRules } from '../schema/notification-rules';
import { notificationRuleChannels } from '../schema/notification-rule-channels';
import { notificationTemplates } from '../schema/notification-templates';
import type { NotificationRule, NotificationChannel, NotificationTemplate } from '../types';

export interface RuleWithChannels extends NotificationRule {
  channels: { channel: NotificationChannel; template: NotificationTemplate }[];
}

@Injectable()
export class NotificationRuleService {
  constructor(private readonly database: DatabaseService) {}

  async findByIdWithChannels(ruleId: string): Promise<RuleWithChannels | null> {
    const [rule] = await this.database.db
      .select()
      .from(notificationRules)
      .where(eq(notificationRules.id, ruleId))
      .limit(1);

    if (!rule) return null;

    const channels = await this.loadChannels(rule.id);
    return {
      ...rule,
      triggerType: rule.triggerType as NotificationRule['triggerType'],
      eventName: rule.eventName,
      delayAmount: rule.delayAmount,
      delayUnit: rule.delayUnit as NotificationRule['delayUnit'],
      scheduleEntityType: rule.scheduleEntityType,
      scheduleDateField: rule.scheduleDateField,
      scheduleDateOperator: rule.scheduleDateOperator as NotificationRule['scheduleDateOperator'],
      scheduleDateAmounts: rule.scheduleDateAmounts as number[] | null,
      scheduleDateUnit: rule.scheduleDateUnit as NotificationRule['scheduleDateUnit'],
      scheduleDaysOfWeek: rule.scheduleDaysOfWeek as number[] | null,
      conditions: rule.conditions as NotificationRule['conditions'],
      recipientStrategy: rule.recipientStrategy as NotificationRule['recipientStrategy'],
      recipientConfig: rule.recipientConfig as Record<string, unknown> | null,
      channels,
    };
  }

  async findActiveByEventName(eventName: string): Promise<RuleWithChannels[]> {
    const rules = await this.database.db
      .select()
      .from(notificationRules)
      .where(and(
        eq(notificationRules.eventName, eventName),
        eq(notificationRules.isActive, true),
        eq(notificationRules.triggerType, 'event'),
      ));

    if (rules.length === 0) return [];

    const result: RuleWithChannels[] = [];
    for (const rule of rules) {
      const channels = await this.loadChannels(rule.id);
      result.push({
        ...rule,
        triggerType: rule.triggerType as NotificationRule['triggerType'],
        eventName: rule.eventName,
        delayAmount: rule.delayAmount,
        delayUnit: rule.delayUnit as NotificationRule['delayUnit'],
        scheduleEntityType: rule.scheduleEntityType,
        scheduleDateField: rule.scheduleDateField,
        scheduleDateOperator: rule.scheduleDateOperator as NotificationRule['scheduleDateOperator'],
        scheduleDateAmounts: rule.scheduleDateAmounts as number[] | null,
        scheduleDateUnit: rule.scheduleDateUnit as NotificationRule['scheduleDateUnit'],
        scheduleDaysOfWeek: rule.scheduleDaysOfWeek as number[] | null,
        conditions: rule.conditions as NotificationRule['conditions'],
        recipientStrategy: rule.recipientStrategy as NotificationRule['recipientStrategy'],
        recipientConfig: rule.recipientConfig as Record<string, unknown> | null,
        channels,
      });
    }

    return result;
  }

  private async loadChannels(ruleId: string) {
    const channelRows = await this.database.db
      .select({
        channel: notificationRuleChannels.channel,
        templateId: notificationRuleChannels.templateId,
        templateName: notificationTemplates.name,
        templateChannel: notificationTemplates.channel,
        templateSubject: notificationTemplates.subject,
        templateBody: notificationTemplates.body,
        templateCreatedAt: notificationTemplates.createdAt,
        templateUpdatedAt: notificationTemplates.updatedAt,
      })
      .from(notificationRuleChannels)
      .innerJoin(notificationTemplates, eq(notificationTemplates.id, notificationRuleChannels.templateId))
      .where(eq(notificationRuleChannels.ruleId, ruleId));

    return channelRows.map((ch) => ({
      channel: ch.channel as NotificationChannel,
      template: {
        id: ch.templateId,
        name: ch.templateName,
        channel: ch.templateChannel as NotificationChannel,
        subject: ch.templateSubject,
        body: ch.templateBody,
        createdAt: ch.templateCreatedAt,
        updatedAt: ch.templateUpdatedAt,
      },
    }));
  }
}
