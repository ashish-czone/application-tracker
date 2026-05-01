import { defineEntity } from '@packages/entity-engine';
import { tasks } from '../schema/tasks';

export const TASKS_CONFIG = defineEntity({
  table: tasks,
  slug: 'tasks',
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
      // Plain text from the engine's perspective; the workflow def lives in
      // tasks.workflow.ts and is registered via WorkflowsModule.forFeature.
      type: 'text',
      label: 'Status',
      sortable: true,
      listVisible: true,
      listOrder: 4,
      cellRenderer: 'PipelineProgressRenderer',
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
