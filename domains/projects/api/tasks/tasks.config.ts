import { defineEntity } from '@packages/entity-engine';
import { tasks } from '../schema/tasks';

export const TASKS_CONFIG = defineEntity({
  table: tasks,
  slug: 'tasks',
  singularName: 'Task',
  pluralName: 'Tasks',
  timestamps: true,
  orderable: true,
  // See PROJECTS_CONFIG — flag is required so the workflow seed service
  // writes the status workflow rows the transition endpoint needs.
  adminConfigurable: true,

  fields: {
    featureId: {
      type: 'lookup',
      label: 'Feature',
      entity: 'features',
      lookupLabelField: 'name',
      required: true,
      listVisible: true,
      listOrder: 1,
    },
    title: {
      type: 'text',
      label: 'Title',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    description: {
      type: 'textarea',
      label: 'Description',
    },
    assigneeId: {
      type: 'user',
      label: 'Assignee',
      isRecipient: true,
      listVisible: true,
      listOrder: 3,
    },
    status: {
      type: 'workflow',
      label: 'Status',
      sortable: true,
      listVisible: true,
      listOrder: 4,
      cellRenderer: 'PipelineProgressRenderer',
      workflow: {
        // Names are code-load-bearing: dashboard rollup treats `done` as the
        // sole completion state. Renaming requires updating the rollup query.
        slug: 'task-status',
        initialState: 'todo',
        states: [
          { name: 'todo',        label: 'To Do',       color: '#6B7280', isSystem: true },
          { name: 'in_progress', label: 'In Progress', color: '#3B82F6', isSystem: true },
          { name: 'blocked',     label: 'Blocked',     color: '#EF4444', isSystem: true },
          { name: 'done',        label: 'Done',        color: '#10B981', isSystem: true },
        ],
        transitions: [
          { from: 'todo',        to: ['in_progress', 'done', 'blocked'] },
          { from: 'in_progress', to: ['done', 'blocked', 'todo'] },
          { from: 'blocked',     to: ['todo', 'in_progress'] },
          { from: 'done',        to: ['todo', 'in_progress'] },
        ],
      },
    },
    dueDate: {
      type: 'date',
      label: 'Due Date',
      sortable: true,
      listVisible: true,
      listOrder: 5,
    },
    completedAt: {
      type: 'datetime',
      label: 'Completed At',
      readonly: true,
      system: true,
    },
  },

  defaultSort: 'sortOrder',

  sections: [
    {
      name: 'Task',
      fields: ['featureId', 'title', 'description', 'assigneeId', 'status', 'dueDate'],
    },
  ],
});
