import { Injectable } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { tasks } from '../schema/tasks';

/**
 * Thin query-side service over the tasks table.
 *
 * CRUD flows through the generic EntityService; this service is read-only.
 * Its only responsibility is the `getKind` lookup that backs the entity-
 * engine guard — idempotency for domain-owned tasks lives in the owning
 * domain's service (e.g. ComplianceTasksService.findByRuleClientPeriod).
 */
@Injectable()
export class TasksService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Returns the kind discriminator for a task, or null if either the
   * task doesn't exist or it's an ad-hoc (kind-less) task. Used by the
   * entity-engine hook in TASKS_CONFIG to reject generic /tasks mutations
   * against rows owned by a specific domain.
   */
  async getKind(id: string): Promise<string | null> {
    const rows = await this.database.db
      .select({ kind: tasks.kind })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    return rows[0]?.kind ?? null;
  }
}
