import { Injectable } from '@nestjs/common';
import { DatabaseService, lt, eq, and, asc, desc, count } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { automationExecutions } from '../schema/automation-executions';
import { automationRules } from '../schema/automation-rules';

@Injectable()
export class ExecutionLogService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ExecutionLogService.name);
  }

  async log(entry: {
    ruleId: string;
    actionIndex: number;
    actionType: string;
    entityType: string;
    entityId: string;
    status: 'success' | 'error';
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.database.db
        .insert(automationExecutions)
        .values(withTenantInsert(automationExecutions, entry));
    } catch (error) {
      this.logger.error('Failed to log execution', {
        ruleId: entry.ruleId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async list(query: {
    page?: number;
    limit?: number;
    ruleId?: string;
    status?: 'success' | 'error';
    entityType?: string;
    actionType?: string;
    sort?: 'executedAt';
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<{
    id: string;
    ruleId: string;
    ruleName: string;
    actionIndex: number;
    actionType: string;
    entityType: string;
    entityId: string;
    status: string;
    errorMessage: string | null;
    executedAt: Date;
  }>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.ruleId) conditions.push(eq(automationExecutions.ruleId, query.ruleId));
    if (query.status) conditions.push(eq(automationExecutions.status, query.status));
    if (query.entityType) conditions.push(eq(automationExecutions.entityType, query.entityType));
    if (query.actionType) conditions.push(eq(automationExecutions.actionType, query.actionType));

    const whereClause = withTenant(automationExecutions, ...conditions);
    const orderFn = query.order === 'asc' ? asc : desc;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(automationExecutions)
      .where(whereClause);

    const data = await this.database.db
      .select({
        id: automationExecutions.id,
        ruleId: automationExecutions.ruleId,
        ruleName: automationRules.name,
        actionIndex: automationExecutions.actionIndex,
        actionType: automationExecutions.actionType,
        entityType: automationExecutions.entityType,
        entityId: automationExecutions.entityId,
        status: automationExecutions.status,
        errorMessage: automationExecutions.errorMessage,
        executedAt: automationExecutions.executedAt,
      })
      .from(automationExecutions)
      .leftJoin(automationRules, eq(automationExecutions.ruleId, automationRules.id))
      .where(whereClause)
      .orderBy(orderFn(automationExecutions.executedAt))
      .limit(limit)
      .offset(offset);

    return {
      data: data.map((row) => ({
        ...row,
        ruleName: row.ruleName ?? 'Deleted rule',
      })),
      meta: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) },
    };
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const deleted = await this.database.db
      .delete(automationExecutions)
      .where(withTenant(automationExecutions, lt(automationExecutions.executedAt, cutoff)))
      .returning({ id: automationExecutions.id });

    this.logger.log(`Cleaned ${deleted.length} execution log entries older than ${days} days`);
    return deleted.length;
  }
}
