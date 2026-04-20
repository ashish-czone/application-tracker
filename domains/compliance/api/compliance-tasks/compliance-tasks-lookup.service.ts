import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { complianceTasks } from '../schema/compliance-tasks';

/**
 * Domain-specific natural-key lookup for compliance tasks. Lives outside
 * the entity-engine because the (rule, client, periodStart) tuple is
 * compliance-specific — entity-engine doesn't know about that semantic
 * and the action/seed need a cheap pre-create check before calling
 * EntityService.create(). Survives key-format changes because it does not
 * rely on the tasks.external_key composite.
 */
@Injectable()
export class ComplianceTasksLookupService {
  constructor(private readonly database: DatabaseService) {}

  async findByRuleClientPeriod(
    ruleId: string,
    clientId: string,
    periodStart: string,
  ): Promise<{ taskId: string } | null> {
    const rows = await this.database.db
      .select({ taskId: complianceTasks.taskId })
      .from(complianceTasks)
      .where(
        and(
          eq(complianceTasks.ruleId, ruleId),
          eq(complianceTasks.clientId, clientId),
          eq(complianceTasks.periodStart, periodStart),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}
