import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService, eq } from '@packages/database';
import { USERS_USER_DEACTIVATED, type UserDeactivatedEvent } from '@packages/users';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { orgUnitMembers } from '../schema/org-unit-members';

/**
 * Q32 hygiene cleanup — on user deactivation, remove every
 * `org_unit_members` row the user participated in. The resolvers
 * (`org_unit_head`, `parent_unit_head`, `org_unit_members`) filter on
 * `users.deletedAt IS NULL` so correctness is already intact even if this
 * listener is delayed; this handler just keeps the join table tidy.
 *
 * Idempotent: second run deletes zero rows. Failure here never rolls back
 * the user deactivation per `event-conventions.md`.
 */
@Injectable()
export class OrgUnitsUserLifecycleListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(OrgUnitsUserLifecycleListener.name);
  }

  @OnEvent(USERS_USER_DEACTIVATED)
  async onUserDeactivated(event: UserDeactivatedEvent): Promise<void> {
    const userId = event.entityId;
    try {
      await this.database.db
        .delete(orgUnitMembers)
        .where(eq(orgUnitMembers.userId, userId));

      this.logger.log('Removed org-unit memberships for deactivated user', { userId });
    } catch (error) {
      this.logger.error('Failed to remove org-unit memberships on user deactivation', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
