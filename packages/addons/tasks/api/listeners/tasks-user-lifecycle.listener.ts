import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService, and, eq, inArray, not } from '@packages/database';
import { USERS_USER_DEACTIVATED, type UserDeactivatedEvent } from '@packages/users';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { tasks } from '../schema/tasks';

// Terminal statuses — tasks in these states are historical and must keep
// their original assignee for audit/reporting. Only open work has its
// assigneeId nulled on user deactivation.
const TERMINAL_STATUSES = ['completed', 'cancelled'];

/**
 * Q32 hygiene cleanup — on user deactivation (`USERS_USER_DEACTIVATED`,
 * aliased from the entity-engine's `users.Deleted`), null `assigneeId` on
 * every open task owned by the user. The `assigneeTeamId` stays intact so
 * the task falls back to the team-level escalation / pickup path (Q20).
 *
 * Idempotent by construction: re-emitting the same event runs an UPDATE
 * whose WHERE clause matches zero rows on the second pass (assigneeId is
 * already NULL). Failure here never rolls back the user deactivation —
 * the authoritative signal is `users.deletedAt`; this is hygiene.
 */
@Injectable()
export class TasksUserLifecycleListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(TasksUserLifecycleListener.name);
  }

  @OnEvent(USERS_USER_DEACTIVATED)
  async onUserDeactivated(event: UserDeactivatedEvent): Promise<void> {
    const userId = event.entityId;
    try {
      const cleared = await this.database.db
        .update(tasks)
        .set({ assigneeId: null })
        .where(and(
          eq(tasks.assigneeId, userId),
          not(inArray(tasks.status, TERMINAL_STATUSES)),
        ))
        .returning({ id: tasks.id });

      if (cleared.length > 0) {
        this.logger.log('Cleared assigneeId on deactivated user\'s open tasks', {
          userId,
          taskCount: cleared.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to null assigneeId on user deactivation', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
