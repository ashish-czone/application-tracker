import { BadRequestException, ConflictException } from '@nestjs/common';
import { defineEntity } from '@packages/entity-engine';
import { eq, or, sql } from 'drizzle-orm';
import { orgUnitMembers } from '@packages/org-units';
import { TASKS_FIELDS, TASKS_METADATA } from '@packages/tasks-contract';
import { tasks } from './schema/tasks';

function validateAssigneeExclusivity(payload: Record<string, unknown>): void {
  const hasAssignee = payload.assigneeId != null && payload.assigneeId !== '';
  const hasTeam = payload.assigneeTeamId != null && payload.assigneeTeamId !== '';
  if (hasAssignee && hasTeam) {
    throw new BadRequestException('A task cannot be assigned to both a user and a team');
  }
}

function applyCompletedAt(payload: Record<string, unknown>): Record<string, unknown> {
  if (!('status' in payload)) return payload;
  return {
    ...payload,
    completedAt: payload.status === 'completed' ? new Date() : null,
  };
}

function rejectKindInPayload(payload: Record<string, unknown>): void {
  if ('kind' in payload) {
    throw new BadRequestException(
      'The `kind` field is owned by the domain that creates the task (e.g. compliance). Generic /tasks endpoints cannot set it.',
    );
  }
}

/**
 * Module-level reference to a kind-lookup function, populated by
 * TasksModule at init time. The entity-engine beforeUpdate/beforeDelete
 * hooks are pure functions without DI access, so we hand them a lookup
 * via this indirection instead of extending the platform's hook
 * signature. An unregistered ref means the host app forgot to import
 * TasksModule — fail-closed, so a missing wire is a loud programming
 * error rather than a silent bypass of the domain-ownership invariant.
 */
type KindLookup = (id: string) => Promise<string | null>;
let kindLookupRef: KindLookup | null = null;
export function registerTasksKindLookup(lookup: KindLookup | null): void {
  kindLookupRef = lookup;
}

/**
 * Blocks mutations against kind-owned tasks on non-domain code paths.
 * Exported so callers that bypass the generic EntityService (e.g.
 * TaskClaimService, which talks to Drizzle directly for optimistic
 * claim semantics) enforce the same invariant: a kinded row must flow
 * through its owning domain endpoint.
 */
export async function assertTaskIsAdHoc(id: string): Promise<void> {
  if (!kindLookupRef) {
    throw new Error(
      'Tasks kind-guard is not wired — TasksModule must be imported before generic /tasks mutations run.',
    );
  }
  const kind = await kindLookupRef(id);
  if (kind) {
    throw new ConflictException(
      `Task ${id} has kind='${kind}' and must be edited through the owning domain endpoint (e.g. /compliance-tasks/${id}).`,
    );
  }
}

export const TASKS_CONFIG = defineEntity({
  ...TASKS_METADATA,
  table: tasks,
  fields: TASKS_FIELDS,

  hooks: {
    beforeCreate: async (payload: Record<string, unknown>) => {
      rejectKindInPayload(payload);
      validateAssigneeExclusivity(payload);
      return applyCompletedAt(payload);
    },
    beforeUpdate: async (id: string, payload: Record<string, unknown>) => {
      rejectKindInPayload(payload);
      await assertTaskIsAdHoc(id);
      let next = payload;
      if ('assigneeId' in next || 'assigneeTeamId' in next) {
        validateAssigneeExclusivity(next);
        if ('assigneeId' in next && next.assigneeId) {
          next = { ...next, assigneeTeamId: null };
        } else if ('assigneeTeamId' in next && next.assigneeTeamId) {
          next = { ...next, assigneeId: null };
        }
      }
      return applyCompletedAt(next);
    },
    beforeDelete: async (id: string) => {
      await assertTaskIsAdHoc(id);
    },
  },

  dataAccess: {
    ownerField: 'assigneeId',
    teamField: 'assigneeTeamId',
    scopes: [
      {
        key: 'my-tasks',
        label: 'Assigned to me or my teams',
        resolve: async (userId: string) => or(
          eq(tasks.assigneeId, userId),
          sql`${tasks.assigneeTeamId} IN (SELECT ${orgUnitMembers.orgUnitId} FROM ${orgUnitMembers} WHERE ${orgUnitMembers.userId} = ${userId})`,
        )!,
      },
    ],
  },
});
