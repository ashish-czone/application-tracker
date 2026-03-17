import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, ilike, asc, desc, count } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { notificationRules } from '../schema/notification-rules';
import { notificationRuleChannels } from '../schema/notification-rule-channels';
import { notificationTemplates } from '../schema/notification-templates';
import type { NotificationRule, NotificationChannel, NotificationTemplate, RecipientStrategy, TriggerType } from '../types';

export interface RuleWithChannels extends NotificationRule {
  channels: { channel: NotificationChannel; templateId: string; template: NotificationTemplate }[];
}

@Injectable()
export class NotificationRulesService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    eventName?: string;
    isActive?: boolean;
    sort?: 'name' | 'createdAt';
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<NotificationRule>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.eventName) conditions.push(eq(notificationRules.eventName, query.eventName));
    if (query.isActive !== undefined) conditions.push(eq(notificationRules.isActive, query.isActive));
    if (query.search) conditions.push(ilike(notificationRules.name, `%${query.search}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumn = { name: notificationRules.name, createdAt: notificationRules.createdAt }[query.sort ?? 'createdAt'];
    const orderFn = query.order === 'asc' ? asc : desc;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(notificationRules)
      .where(whereClause);

    const data = await this.database.db
      .select()
      .from(notificationRules)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    return {
      data: data as NotificationRule[],
      meta: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) },
    };
  }

  async findByIdOrFail(id: string): Promise<RuleWithChannels> {
    const [rule] = await this.database.db
      .select()
      .from(notificationRules)
      .where(eq(notificationRules.id, id))
      .limit(1);

    if (!rule) throw new NotFoundException('Notification rule not found');

    const channels = await this.loadRuleChannels(id);

    return { ...rule, channels } as RuleWithChannels;
  }

  async create(data: {
    name: string;
    triggerType?: string;
    eventName?: string;
    delayAmount?: number;
    delayUnit?: string;
    scheduleEntityType?: string;
    scheduleDateField?: string;
    scheduleDateOperator?: string;
    scheduleDateAmounts?: number[];
    scheduleDateUnit?: string;
    conditions?: Record<string, unknown>[];
    recipientStrategy: RecipientStrategy;
    recipientConfig?: Record<string, unknown>;
    channels: { channel: NotificationChannel; templateId: string }[];
  }): Promise<RuleWithChannels> {
    const [rule] = await this.database.db
      .insert(notificationRules)
      .values({
        name: data.name,
        triggerType: data.triggerType ?? 'event',
        eventName: data.eventName ?? null,
        delayAmount: data.delayAmount ?? null,
        delayUnit: data.delayUnit ?? null,
        scheduleEntityType: data.scheduleEntityType ?? null,
        scheduleDateField: data.scheduleDateField ?? null,
        scheduleDateOperator: data.scheduleDateOperator ?? null,
        scheduleDateAmounts: data.scheduleDateAmounts ?? null,
        scheduleDateUnit: data.scheduleDateUnit ?? null,
        conditions: data.conditions ?? null,
        recipientStrategy: data.recipientStrategy,
        recipientConfig: data.recipientConfig ?? null,
      })
      .returning();

    if (data.channels.length > 0) {
      await this.database.db
        .insert(notificationRuleChannels)
        .values(data.channels.map((ch) => ({
          ruleId: rule.id,
          channel: ch.channel,
          templateId: ch.templateId,
        })));
    }

    const channels = await this.loadRuleChannels(rule.id);

    return { ...rule, channels } as RuleWithChannels;
  }

  async update(id: string, data: {
    name?: string;
    recipientStrategy?: RecipientStrategy;
    recipientConfig?: Record<string, unknown>;
    isActive?: boolean;
    conditions?: Record<string, unknown>[];
  }): Promise<RuleWithChannels> {
    await this.findByIdOrFail(id);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.recipientStrategy !== undefined) updateValues.recipientStrategy = data.recipientStrategy;
    if (data.recipientConfig !== undefined) updateValues.recipientConfig = data.recipientConfig;
    if (data.isActive !== undefined) updateValues.isActive = data.isActive;
    if (data.conditions !== undefined) updateValues.conditions = data.conditions;

    if (Object.keys(updateValues).length > 0) {
      await this.database.db
        .update(notificationRules)
        .set(updateValues)
        .where(eq(notificationRules.id, id));
    }

    return this.findByIdOrFail(id);
  }

  async setChannels(id: string, channels: { channel: NotificationChannel; templateId: string }[]): Promise<RuleWithChannels> {
    await this.findByIdOrFail(id);

    // Full replace
    await this.database.db
      .delete(notificationRuleChannels)
      .where(eq(notificationRuleChannels.ruleId, id));

    if (channels.length > 0) {
      await this.database.db
        .insert(notificationRuleChannels)
        .values(channels.map((ch) => ({
          ruleId: id,
          channel: ch.channel,
          templateId: ch.templateId,
        })));
    }

    return this.findByIdOrFail(id);
  }

  async delete(id: string): Promise<void> {
    await this.findByIdOrFail(id);

    await this.database.db
      .delete(notificationRules)
      .where(eq(notificationRules.id, id));
  }

  private async loadRuleChannels(ruleId: string) {
    const rows = await this.database.db
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

    return rows.map((r) => ({
      channel: r.channel as NotificationChannel,
      templateId: r.templateId,
      template: {
        id: r.templateId,
        name: r.templateName,
        channel: r.templateChannel as NotificationChannel,
        subject: r.templateSubject,
        body: r.templateBody,
        createdAt: r.templateCreatedAt,
        updatedAt: r.templateUpdatedAt,
      },
    }));
  }
}
