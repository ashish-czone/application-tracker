import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { tasks } from '../schema/tasks';

/**
 * Thin query-side service over the tasks table. CRUD flows through the
 * generic EntityService; this service exposes only platform-level lookups
 * that cross-cutting callers need — currently an idempotency lookup used
 * by automation actions that generate polymorphic tasks.
 */
@Injectable()
export class TasksService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Idempotency lookup for automation-generated tasks. Callers pass the
   * `relatedEntityType` the task is attached to and the format-stable
   * `externalKey` they minted; a match returns the existing task id so
   * the caller can skip re-creation. Scoped by related entity type so
   * two domains can mint the same string without colliding.
   */
  async findByExternalKey(relatedEntityType: string, externalKey: string): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.relatedEntityType, relatedEntityType), eq(tasks.externalKey, externalKey)))
      .limit(1);
    return rows[0] ?? null;
  }
}
