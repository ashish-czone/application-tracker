import { defineEntity } from '@packages/entity-engine';
import { tasks } from './schema/tasks';

export const TASKS_CONFIG = defineEntity({
  table: tasks,
  slug: 'tasks',
  singularName: 'Task',
  pluralName: 'Tasks',
  softDelete: true,
  timestamps: true,

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
        initialState: 'open',
        states: [
          { name: 'open', label: 'Open', color: '#6B7280' },
          { name: 'in_progress', label: 'In Progress', color: '#3B82F6' },
          { name: 'done', label: 'Done', color: '#10B981' },
          { name: 'cancelled', label: 'Cancelled', color: '#EF4444' },
        ],
        transitions: [
          { from: 'open', to: ['in_progress', 'cancelled'] },
          { from: 'in_progress', to: ['done', 'cancelled'] },
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
  },

  defaultSort: 'createdAt',

  sections: [
    {
      name: 'Basic Information',
      fields: ['title', 'description', 'status', 'priority', 'assigneeId', 'dueDate'],
    },
  ],

  ui: {
    icon: 'CheckSquare',
    navGroup: 'main',
    navOrder: 3,
    createMode: 'modal',
  },
});
