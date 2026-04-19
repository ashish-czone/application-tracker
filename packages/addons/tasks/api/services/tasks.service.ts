import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { tasks } from '../schema/tasks';

/**
 * Thin query-side service over the tasks table.
 *
 * Exists to give recurring generators (compliance, subscriptions, renewals)
 * a domain-agnostic idempotency primitive via `external_key`. CRUD still
 * flows through the generic EntityService; this service is read-only and
 * narrow on purpose.
 */
@Injectable()
export class TasksService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Lookup a task by its (kind, relatedEntityId, externalKey) triple.
   * The triple is protected by a partial unique index so at most one row matches.
   * Returns null when no task exists — callers use this for idempotency checks.
   */
  async findByExternalKey(
    kind: string,
    relatedEntityId: string,
    externalKey: string,
  ): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.kind, kind),
          eq(tasks.relatedEntityId, relatedEntityId),
          eq(tasks.externalKey, externalKey),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}
