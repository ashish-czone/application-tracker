import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, and } from '@packages/database';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { automationActionLog } from '../schema/automation-action-log';
import type { AutomationActionLogEntry } from '@packages/automation-contracts';

@Injectable()
export class ProvenanceService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ProvenanceService.name);
  }

  /**
   * Record that an action created/modified a target entity.
   * Called by the automation engine after a linked action executes.
   */
  async log(entry: {
    ruleId: string;
    actionIndex: number;
    linkName: string | null;
    sourceEntityType: string;
    sourceEntityId: string;
    targetEntityType: string;
    targetEntityId: string;
  }): Promise<AutomationActionLogEntry> {
    const [row] = await this.database.db
      .insert(automationActionLog)
      .values(withTenantInsert(automationActionLog, entry))
      .returning();

    this.logger.debug('Provenance logged', {
      ruleId: entry.ruleId,
      linkName: entry.linkName,
      sourceEntityId: entry.sourceEntityId,
      targetEntityId: entry.targetEntityId,
    });

    return {
      id: row.id,
      ruleId: row.ruleId,
      actionIndex: row.actionIndex,
      linkName: row.linkName,
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
      targetEntityType: row.targetEntityType,
      targetEntityId: row.targetEntityId,
      createdAt: row.createdAt,
    };
  }

  /**
   * Find linked target entities by rule + link name + source entity.
   * Used by the lifecycle engine to resolve which entities to update/delete
   * when the source entity changes.
   */
  async findLinked(params: {
    ruleId: string;
    linkName: string;
    sourceEntityType: string;
    sourceEntityId: string;
  }): Promise<AutomationActionLogEntry[]> {
    const rows = await this.database.db
      .select()
      .from(automationActionLog)
      .where(withTenant(
        automationActionLog,
        eq(automationActionLog.ruleId, params.ruleId),
        eq(automationActionLog.linkName, params.linkName),
        eq(automationActionLog.sourceEntityType, params.sourceEntityType),
        eq(automationActionLog.sourceEntityId, params.sourceEntityId),
      ));

    return rows.map((r) => ({
      id: r.id,
      ruleId: r.ruleId,
      actionIndex: r.actionIndex,
      linkName: r.linkName,
      sourceEntityType: r.sourceEntityType,
      sourceEntityId: r.sourceEntityId,
      targetEntityType: r.targetEntityType,
      targetEntityId: r.targetEntityId,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Check if a linked entity already exists for idempotency.
   * Prevents duplicate creation when a rule fires multiple times.
   */
  async hasLinked(params: {
    ruleId: string;
    linkName: string;
    sourceEntityType: string;
    sourceEntityId: string;
  }): Promise<boolean> {
    const entries = await this.findLinked(params);
    return entries.length > 0;
  }

  /**
   * Remove provenance entries when a linked target is deleted.
   */
  async removeByTarget(targetEntityType: string, targetEntityId: string): Promise<void> {
    await this.database.db
      .delete(automationActionLog)
      .where(withTenant(
        automationActionLog,
        eq(automationActionLog.targetEntityType, targetEntityType),
        eq(automationActionLog.targetEntityId, targetEntityId),
      ));
  }

  /**
   * Remove all provenance entries for a source entity (e.g., when source is deleted).
   */
  async removeBySource(sourceEntityType: string, sourceEntityId: string): Promise<void> {
    await this.database.db
      .delete(automationActionLog)
      .where(withTenant(
        automationActionLog,
        eq(automationActionLog.sourceEntityType, sourceEntityType),
        eq(automationActionLog.sourceEntityId, sourceEntityId),
      ));
  }
}
