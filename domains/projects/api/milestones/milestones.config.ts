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
      type: 'workflow',
      label: 'Status',
      sortable: true,
      listVisible: true,
      listOrder: 3,
      cellRenderer: 'PipelineProgressRenderer',
      workflow: {
        slug: 'milestone-status',
        initialState: 'pending',
        states: [
          { name: 'pending',     label: 'Pending',     color: '#6B7280' },
          { name: 'in_progress', label: 'In Progress', color: '#3B82F6' },
          { name: 'completed',   label: 'Completed',   color: '#10B981' },
        ],
        transitions: [
          { from: 'pending',     to: ['in_progress'] },
          { from: 'in_progress', to: ['completed', 'pending'] },
          { from: 'completed',   to: ['in_progress'] },
        ],
      },
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
