import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq, inArray, isNull, not } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';

import { complianceFilings } from './compliance-filings.schema';
import {
  COMPLIANCE_FILINGS_ASSIGNEE_CLEARED,
  type ComplianceFilingsAssigneeClearedPayload,
} from '../events/types';

/**
 * Terminal filing statuses — already at end-of-life, no need to disturb
 * their assignee even when the user is deactivated. Keeps the historical
 * record of "user X owned this filing when it closed" intact.
 */
const TERMINAL_FILING_STATUSES = ['completed', 'cancelled'];

/**
 * Cascade for US-7.4 / US-12.2 / US-12.3: when a user is soft-deleted, every
 * non-terminal compliance filing assigned to that user gets `assigneeId`
 * cleared. The team assignment (`assigneeTeamId`) is preserved so the
 * filing stays routable to its originating team for reassignment.
 *
 * Driven from `AppUsersService.cleanupOnSoftDelete` (subclass override of
 * the platform users hook), not from an event listener — failures abort
 * the deactivation in the same call site, so an admin sees the failure
 * immediately instead of discovering dangling state in audit logs later.
 *
 * Emits one batched `compliance.FilingsAssigneeCleared` event after the
 * bulk update commits, carrying every affected filing id. Per-filing
 * events would flood the audit stream with N rows for one admin action;
 * batched gives reviewers one entry — "23 filings unassigned because user
 * X was deactivated".
 */
@Injectable()
export class ComplianceFilingsAssigneeCleanupService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ComplianceFilingsAssigneeCleanupService.name);
  }

  /**
   * Bulk-clear `assigneeId` on every non-terminal filing currently assigned
   * to `deactivatedUserId`. Idempotent — re-firing on the same user is a
   * no-op (the WHERE clause finds nothing on the second pass). Soft-deleted
   * filings are excluded so we don't touch tombstoned rows.
   *
   * Returns the affected filing ids. The empty case (no filings owned by
   * the deactivated user) still completes successfully and emits no event —
   * audit only carries entries for actual state changes.
   */
  async clearAssigneeForUser(
    deactivatedUserId: string,
    actorId: string,
  ): Promise<{ filingIds: string[] }> {
    const updatedRows = await this.database.db
      .update(complianceFilings)
      .set({ assigneeId: null })
      .where(
        and(
          eq(complianceFilings.assigneeId, deactivatedUserId),
          not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
          isNull(complianceFilings.deletedAt),
        ),
      )
      .returning({ id: complianceFilings.id });

    const filingIds = updatedRows.map((r) => r.id);

    if (filingIds.length === 0) {
      this.logger.log('User deactivated — no non-terminal filings to clear', {
        deactivatedUserId,
      });
      return { filingIds };
    }

    this.logger.log('User deactivated — cleared assignee on non-terminal filings', {
      deactivatedUserId,
      count: filingIds.length,
    });

    const payload: ComplianceFilingsAssigneeClearedPayload = {
      deactivatedUserId,
      filingIds,
      count: filingIds.length,
    };
    this.events.emitDynamic(COMPLIANCE_FILINGS_ASSIGNEE_CLEARED, {
      entityType: 'compliance',
      entityId: deactivatedUserId,
      actorId,
      payload,
    });

    return { filingIds };
  }
}
