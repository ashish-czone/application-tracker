import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, ilike, asc, desc, count } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { automationRules } from '../schema/automation-rules';
import type { AutomationRule, ActionConfig, LifecycleUpdateBinding, LifecycleDeleteBinding, TriggerType } from '../types';
import type { Condition } from '@packages/common';

@Injectable()
export class AutomationRuleService {
  constructor(private readonly database: DatabaseService) {}

  async findActiveByEventName(eventName: string): Promise<AutomationRule[]> {
    const rows = await this.database.db
      .select()
      .from(automationRules)
      .where(withTenant(
        automationRules,
        eq(automationRules.eventName, eventName),
        eq(automationRules.isActive, true),
        eq(automationRules.triggerType, 'event'),
      ));

    return rows.map(this.toRule);
  }

  /**
   * Find rules that have lifecycle bindings for a given event name's entity type.
   * These are rules that need to check onSourceUpdated/onSourceDeleted
   * when the source entity changes.
   */
  async findActiveWithLifecycleBindings(): Promise<AutomationRule[]> {
    const rows = await this.database.db
      .select()
      .from(automationRules)
      .where(withTenant(automationRules, eq(automationRules.isActive, true)));

    return rows
      .map(this.toRule)
      .filter((r) =>
        (r.onSourceUpdated && r.onSourceUpdated.length > 0) ||
        (r.onSourceDeleted && r.onSourceDeleted.length > 0),
      );
  }

  async findActiveScheduleRules(): Promise<AutomationRule[]> {
    const rows = await this.database.db
      .select()
      .from(automationRules)
      .where(withTenant(
        automationRules,
        eq(automationRules.isActive, true),
      ));

    return rows
      .map(this.toRule)
      .filter((r) => r.triggerType === 'schedule_once' || r.triggerType === 'schedule_recurring');
  }

  async findByIdOrFail(id: string): Promise<AutomationRule> {
    const [row] = await this.database.db
      .select()
      .from(automationRules)
      .where(withTenant(automationRules, eq(automationRules.id, id)))
      .limit(1);

    if (!row) throw new NotFoundException('Automation rule not found');

    return this.toRule(row);
  }

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    eventName?: string;
    isActive?: boolean;
    sort?: 'name' | 'createdAt';
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<AutomationRule>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.eventName) conditions.push(eq(automationRules.eventName, query.eventName));
    if (query.isActive !== undefined) conditions.push(eq(automationRules.isActive, query.isActive));
    if (query.search) conditions.push(ilike(automationRules.name, `%${query.search}%`));

    const whereClause = withTenant(automationRules, ...conditions);
    const sortColumn = { name: automationRules.name, createdAt: automationRules.createdAt }[query.sort ?? 'createdAt'];
    const orderFn = query.order === 'asc' ? asc : desc;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(automationRules)
      .where(whereClause);

    const data = await this.database.db
      .select()
      .from(automationRules)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    return {
      data: data.map(this.toRule),
      meta: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) },
    };
  }

  async create(data: {
    name: string;
    description?: string;
    triggerType?: string;
    eventName?: string;
    delayAmount?: number;
    delayUnit?: string;
    scheduleEntityType?: string;
    scheduleDateField?: string;
    scheduleDateOperator?: string;
    scheduleDateAmounts?: number[];
    scheduleDateUnit?: string;
    scheduleDaysOfWeek?: number[];
    conditions?: Condition[];
    actions: ActionConfig[];
    onSourceUpdated?: LifecycleUpdateBinding[];
    onSourceDeleted?: LifecycleDeleteBinding[];
  }): Promise<AutomationRule> {
    const [row] = await this.database.db
      .insert(automationRules)
      .values(withTenantInsert(automationRules, {
        name: data.name,
        description: data.description ?? null,
        triggerType: data.triggerType ?? 'event',
        eventName: data.eventName ?? null,
        delayAmount: data.delayAmount ?? null,
        delayUnit: data.delayUnit ?? null,
        scheduleEntityType: data.scheduleEntityType ?? null,
        scheduleDateField: data.scheduleDateField ?? null,
        scheduleDateOperator: data.scheduleDateOperator ?? null,
        scheduleDateAmounts: data.scheduleDateAmounts ?? null,
        scheduleDateUnit: data.scheduleDateUnit ?? null,
        scheduleDaysOfWeek: data.scheduleDaysOfWeek ?? null,
        conditions: data.conditions ?? null,
        actions: data.actions,
        onSourceUpdated: data.onSourceUpdated ?? null,
        onSourceDeleted: data.onSourceDeleted ?? null,
      }))
      .returning();

    return this.toRule(row);
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
    conditions?: Condition[];
    actions?: ActionConfig[];
    onSourceUpdated?: LifecycleUpdateBinding[];
    onSourceDeleted?: LifecycleDeleteBinding[];
  }): Promise<AutomationRule> {
    await this.findByIdOrFail(id);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.isActive !== undefined) updateValues.isActive = data.isActive;
    if (data.conditions !== undefined) updateValues.conditions = data.conditions;
    if (data.actions !== undefined) updateValues.actions = data.actions;
    if (data.onSourceUpdated !== undefined) updateValues.onSourceUpdated = data.onSourceUpdated;
    if (data.onSourceDeleted !== undefined) updateValues.onSourceDeleted = data.onSourceDeleted;
    updateValues.updatedAt = new Date();

    if (Object.keys(updateValues).length > 0) {
      await this.database.db
        .update(automationRules)
        .set(updateValues)
        .where(withTenant(automationRules, eq(automationRules.id, id)));
    }

    return this.findByIdOrFail(id);
  }

  async delete(id: string): Promise<void> {
    await this.findByIdOrFail(id);
    await this.database.db
      .delete(automationRules)
      .where(withTenant(automationRules, eq(automationRules.id, id)));
  }

  private toRule(row: typeof automationRules.$inferSelect): AutomationRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      triggerType: row.triggerType as TriggerType,
      eventName: row.eventName,
      delayAmount: row.delayAmount,
      delayUnit: row.delayUnit as AutomationRule['delayUnit'],
      scheduleEntityType: row.scheduleEntityType,
      scheduleDateField: row.scheduleDateField,
      scheduleDateOperator: row.scheduleDateOperator as AutomationRule['scheduleDateOperator'],
      scheduleDateAmounts: row.scheduleDateAmounts as number[] | null,
      scheduleDateUnit: row.scheduleDateUnit as AutomationRule['scheduleDateUnit'],
      scheduleDaysOfWeek: row.scheduleDaysOfWeek as number[] | null,
      conditions: row.conditions as Condition[] | null,
      actions: row.actions as ActionConfig[],
      onSourceUpdated: row.onSourceUpdated as LifecycleUpdateBinding[] | null,
      onSourceDeleted: row.onSourceDeleted as LifecycleDeleteBinding[] | null,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
