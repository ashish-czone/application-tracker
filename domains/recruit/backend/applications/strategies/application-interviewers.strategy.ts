import { Injectable } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { entityMultiValues } from '@packages/entity-relations';
import type { UserResolution } from '@packages/automations';
import type { UserResolverStrategy, UserResolutionContext } from '@packages/automations';
import { applications } from '../schema/applications';
import { interviews } from '../../interviews/schema/interviews';

/**
 * Domain-specific user resolver strategy that finds all interviewers
 * for a given application.
 *
 * Traversal: application → (candidateId + jobOpeningId) → interviews → interviewers (multi_user via entity_multi_values)
 *
 * Config: none — the strategy knows the domain relationships.
 */
@Injectable()
export class ApplicationInterviewersStrategy implements UserResolverStrategy {
  readonly type = 'application_interviewers';
  readonly label = 'Application Interviewers';
  readonly configSchema = {};

  constructor(private readonly database: DatabaseService) {}

  async resolve(_resolution: UserResolution, context: UserResolutionContext): Promise<string[]> {
    const entityId = context.entityId ?? context.event?.entityId;
    if (!entityId) return [];

    // Step 1: Get application's candidateId + jobOpeningId
    const app = await this.getApplication(entityId, context);
    if (!app?.candidateId || !app?.jobOpeningId) return [];

    // Step 2: Find interviews for this candidate + job opening
    const interviewRows = await this.database.db
      .select({ id: interviews.id })
      .from(interviews)
      .where(withTenant(interviews,
        eq(interviews.candidateId, app.candidateId),
        eq(interviews.jobOpeningId, app.jobOpeningId),
        isNull(interviews.deletedAt),
      ));

    if (interviewRows.length === 0) return [];

    // Step 3: Get all interviewers from entity_multi_values for these interviews
    const interviewIds = interviewRows.map(r => r.id);
    const userIds = new Set<string>();

    for (const interviewId of interviewIds) {
      const rows = await this.database.db
        .select({ targetId: entityMultiValues.targetId })
        .from(entityMultiValues)
        .where(withTenant(entityMultiValues,
          eq(entityMultiValues.entityType, 'interviews'),
          eq(entityMultiValues.entityId, interviewId),
          eq(entityMultiValues.fieldKey, 'interviewers'),
        ));

      for (const row of rows) {
        userIds.add(row.targetId);
      }
    }

    return Array.from(userIds);
  }

  private async getApplication(
    entityId: string,
    context: UserResolutionContext,
  ): Promise<{ candidateId: string; jobOpeningId: string } | null> {
    // Try event payload first
    if (context.event?.payload) {
      const after = context.event.payload.after as Record<string, unknown> | undefined;
      const candidateId = (after?.candidateId ?? context.event.payload.candidateId) as string | undefined;
      const jobOpeningId = (after?.jobOpeningId ?? context.event.payload.jobOpeningId) as string | undefined;
      if (candidateId && jobOpeningId) return { candidateId, jobOpeningId };
    }

    // Try entity data
    if (context.entityData) {
      const candidateId = context.entityData.candidateId as string | undefined;
      const jobOpeningId = context.entityData.jobOpeningId as string | undefined;
      if (candidateId && jobOpeningId) return { candidateId, jobOpeningId };
    }

    // DB fallback
    const [row] = await this.database.db
      .select({
        candidateId: applications.candidateId,
        jobOpeningId: applications.jobOpeningId,
      })
      .from(applications)
      .where(withTenant(applications, eq(applications.id, entityId)))
      .limit(1);

    if (!row) return null;
    return { candidateId: row.candidateId, jobOpeningId: row.jobOpeningId };
  }
}
