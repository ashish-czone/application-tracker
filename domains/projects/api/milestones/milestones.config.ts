import { defineEntity } from '@packages/entity-engine';
import { milestones } from '../schema/milestones';

export const MILESTONES_CONFIG = defineEntity({
  table: milestones,
  slug: 'milestones',
  timestamps: true,
  orderable: true,
  // See PROJECTS_CONFIG — flag is required so the workflow seed service
  // writes the status workflow rows the transition endpoint needs.
  adminConfigurable: true,

  fields: {
    projectId: {
      type: 'lookup',
      label: 'Project',
      entity: 'projects',
      lookupLabelField: 'name',
      required: true,
      listVisible: true,
      listOrder: 1,
    },
    name: {
      type: 'text',
      label: 'Name',
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
    status: {
      // Plain text from the engine's perspective; the workflow def lives in
      // milestones.workflow.ts and is registered via WorkflowsModule.forFeature.
      type: 'text',
      label: 'Status',
      sortable: true,
      listVisible: true,
      listOrder: 3,
      cellRenderer: 'PipelineProgressRenderer',
    },
    dueDate: {
      type: 'date',
      label: 'Due Date',
      sortable: true,
      listVisible: true,
      listOrder: 4,
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
      name: 'Milestone',
      fields: ['projectId', 'name', 'description', 'status', 'dueDate'],
    },
  ],
});
