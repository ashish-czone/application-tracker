import { Injectable } from '@nestjs/common';
import { DatabaseService, lt } from '@packages/database';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { automationExecutions } from '../schema/automation-executions';

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
        .values(entry);
    } catch (error) {
      this.logger.error('Failed to log execution', {
        ruleId: entry.ruleId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const deleted = await this.database.db
      .delete(automationExecutions)
      .where(lt(automationExecutions.executedAt, cutoff))
      .returning({ id: automationExecutions.id });

    this.logger.log(`Cleaned ${deleted.length} execution log entries older than ${days} days`);
    return deleted.length;
  }
}
