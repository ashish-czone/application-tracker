import { BadRequestException } from '@nestjs/common';
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

export const TASKS_CONFIG = defineEntity({
  ...TASKS_METADATA,
  table: tasks,
  fields: TASKS_FIELDS,

  hooks: {
    beforeCreate: async (payload: Record<string, unknown>) => {
      validateAssigneeExclusivity(payload);
      return applyCompletedAt(payload);
    },
    beforeUpdate: async (_id: string, payload: Record<string, unknown>) => {
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
