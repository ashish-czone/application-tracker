import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { tasks } from '../schema/tasks';

/**
 * Thin query-side service over the tasks table.
 *
 * CRUD flows through the generic EntityService; this service exposes only
 * the platform-level lookups that cross-cutting callers need:
 *   - `getKind`  — backs the entity-engine guard that blocks generic
 *     /tasks mutations against kind-owned rows.
 *   - `findByExternalKey` — the idempotency lookup used by automation
 *     actions / domain services that generate tasks (e.g. the compliance
 *     generator). `external_key` lives on `tasks` as a platform primitive
 *     so every kind reuses the same mechanism; uniqueness is enforced by
 *     a partial index on (kind, external_key).
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

  /**
   * Idempotency lookup for automation-generated tasks. Callers pass the
   * `kind` they own and the format-stable `externalKey` they minted; a
   * match returns the existing task id so the caller can skip re-creation.
   * Scoped by kind so two domains can mint the same string without
   * colliding.
   */
  async findByExternalKey(kind: string, externalKey: string): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.kind, kind), eq(tasks.externalKey, externalKey)))
      .limit(1);
    return rows[0] ?? null;
  }
}
