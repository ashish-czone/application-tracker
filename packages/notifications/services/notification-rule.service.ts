import { Injectable } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
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

  async findActiveByEventName(eventName: string): Promise<RuleWithChannels[]> {
    // Fetch matching active rules
    const rules = await this.database.db
      .select()
      .from(notificationRules)
      .where(eq(notificationRules.eventName, eventName));

    const activeRules = rules.filter((r) => r.isActive);
    if (activeRules.length === 0) return [];

    // Fetch channels + templates for each rule
    const result: RuleWithChannels[] = [];
    for (const rule of activeRules) {
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
        .where(eq(notificationRuleChannels.ruleId, rule.id));

      result.push({
        ...rule,
        recipientStrategy: rule.recipientStrategy as NotificationRule['recipientStrategy'],
        recipientConfig: rule.recipientConfig as Record<string, unknown> | null,
        channels: channelRows.map((ch) => ({
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
        })),
      });
    }

    return result;
  }
}
