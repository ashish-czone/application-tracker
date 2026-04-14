import { BadRequestException } from '@nestjs/common';
import { defineEntity } from '@packages/entity-engine';
import { eq, or, sql } from 'drizzle-orm';
import { orgUnitMembers } from '@packages/org-units';
import { tasks } from './schema/tasks';

function validateAssigneeExclusivity(payload: Record<string, unknown>): void {
  const hasAssignee = payload.assigneeId != null && payload.assigneeId !== '';
  const hasTeam = payload.assigneeTeamId != null && payload.assigneeTeamId !== '';
  if (hasAssignee && hasTeam) {
    throw new BadRequestException('A task cannot be assigned to both a user and a team');
  }
}

export const TASKS_CONFIG = defineEntity({
  table: tasks,
  slug: 'tasks',
  singularName: 'Task',
  pluralName: 'Tasks',
  softDelete: true,
  timestamps: true,
  hasNotes: true,
  hasAttachments: true,
  hasTags: { groupSlug: 'task-tags' },

  extraPermissions: [
    { action: 'assign', description: 'Assign tasks to users or teams' },
    { action: 'submitForReview', description: 'Submit a task for review' },
    { action: 'approveReview', description: 'Approve a task in review and mark it completed' },
    { action: 'complete', description: 'Mark tasks as completed' },
    { action: 'cancel', description: 'Cancel tasks' },
    { action: 'reopen', description: 'Reopen completed or cancelled tasks' },
  ],

  fields: {
    title: {
      type: 'text',
      label: 'Title',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      quickCreate: true,
      listVisible: true,
      listOrder: 1,
    },
    description: {
      type: 'textarea',
      label: 'Description',
      quickCreate: true,
    },
    status: {
      type: 'workflow',
      label: 'Status',
      system: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
      cellRenderer: 'PipelineProgressRenderer',
      workflow: {
        slug: 'task-status',
        initialState: 'pending',
        states: [
          { name: 'pending', label: 'Pending', color: '#6B7280' },
          { name: 'in_progress', label: 'In Progress', color: '#3B82F6' },
          { name: 'review', label: 'In Review', color: '#F59E0B' },
          { name: 'completed', label: 'Completed', color: '#10B981' },
          { name: 'cancelled', label: 'Cancelled', color: '#EF4444' },
        ],
        transitions: [
          { from: 'pending', to: [
            'in_progress',
            { state: 'cancelled', requiredPermissions: ['tasks.cancel'] },
          ]},
          { from: 'in_progress', to: [
            { state: 'review', requiredPermissions: ['tasks.submitForReview'] },
            { state: 'completed', requiredPermissions: ['tasks.complete'] },
            { state: 'cancelled', requiredPermissions: ['tasks.cancel'] },
          ]},
          { from: 'review', to: [
            { state: 'completed', requiredPermissions: ['tasks.approveReview'] },
            { state: 'in_progress', requiredPermissions: ['tasks.reopen'] },
            { state: 'cancelled', requiredPermissions: ['tasks.cancel'] },
          ]},
          { from: 'completed', to: [
            { state: 'pending', requiredPermissions: ['tasks.reopen'] },
          ]},
          { from: 'cancelled', to: [
            { state: 'pending', requiredPermissions: ['tasks.reopen'] },
          ]},
        ],
      },
    },
    priority: {
      type: 'picklist',
      label: 'Priority',
      sortable: true,
      quickCreate: true,
      listVisible: true,
      listOrder: 3,
      defaultValue: 'medium',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium', isDefault: true },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
    },
    assigneeId: {
      type: 'user',
      label: 'Assignee',
      quickCreate: true,
      listVisible: true,
      listOrder: 4,
      isRecipient: true,
      cellRenderer: 'TaskAssigneeCell',
    },
    assigneeTeamId: {
      type: 'lookup',
      label: 'Assigned Team',
      entity: 'org-units',
      lookupLabelField: 'name',
      lookupSearchFields: ['name'],
      quickCreate: true,
      listColumnHidden: true,
    },
    dueDate: {
      type: 'date',
      label: 'Due Date',
      sortable: true,
      quickCreate: true,
      listVisible: true,
      listOrder: 5,
    },
    createdBy: {
      type: 'user',
      label: 'Creator',
      system: true,
      readonly: true,
      isRecipient: true,
    },
    relatedEntityType: {
      type: 'text',
      label: 'Related Entity Type',
      system: true,
      readonly: true,
      excludeFromList: true,
    },
    relatedEntityId: {
      type: 'text',
      label: 'Related Entity ID',
      system: true,
      readonly: true,
      excludeFromList: true,
    },
    externalKey: {
      type: 'text',
      label: 'External Key',
      system: true,
      readonly: true,
      excludeFromList: true,
    },
  },

  defaultSort: 'createdAt',

  sections: [
    {
      name: 'Basic Information',
      fields: ['title', 'description', 'status', 'priority', 'assigneeId', 'assigneeTeamId', 'dueDate'],
    },
  ],

  hooks: {
    beforeCreate: async (payload: Record<string, unknown>) => {
      validateAssigneeExclusivity(payload);
      return payload;
    },
    beforeUpdate: async (_id: string, payload: Record<string, unknown>) => {
      if ('assigneeId' in payload || 'assigneeTeamId' in payload) {
        validateAssigneeExclusivity(payload);
        if ('assigneeId' in payload && payload.assigneeId) {
          return { ...payload, assigneeTeamId: null };
        }
        if ('assigneeTeamId' in payload && payload.assigneeTeamId) {
          return { ...payload, assigneeId: null };
        }
      }
      return payload;
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

  ui: {
    icon: 'CheckSquare',
    navGroup: 'main',
    navOrder: 3,
    createMode: 'modal',
  },
});
