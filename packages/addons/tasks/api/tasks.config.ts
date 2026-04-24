import { defineEntity } from '@packages/entity-engine';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { users } from '@packages/database/schema';
import { orgUnitMembers } from '@packages/org-units';
import { TASKS_FIELDS, TASKS_METADATA } from '@packages/tasks-contract';
import { tasks } from './schema/tasks';

/**
 * Stamps / clears `completedAt` based on the status transition in the
 * payload: moving TO `completed` stamps now(), moving AWAY clears it,
 * and payloads that don't touch status are returned unchanged.
 */
export function applyCompletedAt(payload: Record<string, unknown>): Record<string, unknown> {
  if (!('status' in payload)) return payload;
  return {
    ...payload,
    completedAt: payload.status === 'completed' ? new Date() : null,
  };
}

export const TASKS_CONFIG = defineEntity({
  ...TASKS_METADATA,
  table: tasks,
  fields: TASKS_FIELDS,

  dataAccess: {
    // Tasks are anchored on the current assignee / assignee's team rather
    // than the creator — `own` on a task means "assigned to me," not
    // "I created it." Mapping `creator -> assigneeId` preserves that
    // pre-refactor behaviour; adjust if the semantic is ever reviewed.
    anchors: { creator: 'assigneeId', assignee: 'assigneeId', team: 'assigneeTeamId' },
    scopes: [
      {
        // The personal queue shows tasks the user owns directly, plus tasks
        // still unassigned in teams they're a member of (the team pool they
        // can pick up). It explicitly does NOT include teammates' in-progress
        // work — that belongs on the team board, not the personal queue.
        //
        // The EXISTS guard on `users.deletedAt IS NULL` short-circuits the
        // scope if the caller's session is stale after deactivation (Q32):
        // a deactivated user's personal queue must be empty even before the
        // tasks / org-units cleanup listeners catch up.
        key: 'my-tasks',
        label: 'Assigned to me or unclaimed in my teams',
        resolve: async (userId: string) => and(
          sql`EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${userId} AND ${users.deletedAt} IS NULL)`,
          or(
            eq(tasks.assigneeId, userId),
            and(
              isNull(tasks.assigneeId),
              sql`${tasks.assigneeTeamId} IN (SELECT ${orgUnitMembers.orgUnitId} FROM ${orgUnitMembers} WHERE ${orgUnitMembers.userId} = ${userId})`,
            ),
          ),
        )!,
      },
    ],
  },
});
