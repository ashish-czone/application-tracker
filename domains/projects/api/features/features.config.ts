import { defineEntity } from '@packages/entity-engine';
import { features } from '../schema/features';

export const FEATURES_CONFIG = defineEntity({
  table: features,
  slug: 'features',
  timestamps: true,
  orderable: true,
  // See PROJECTS_CONFIG — flag is required so the workflow seed service
  // writes the status workflow rows the transition endpoint needs.
  adminConfigurable: true,

  fields: {
    milestoneId: {
      type: 'lookup',
      label: 'Milestone',
      entity: 'milestones',
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
        slug: 'feature-status',
        initialState: 'backlog',
        states: [
          { name: 'backlog',     label: 'Backlog',     color: '#6B7280' },
          { name: 'in_progress', label: 'In Progress', color: '#3B82F6' },
          { name: 'in_review',   label: 'In Review',   color: '#F59E0B' },
          { name: 'done',        label: 'Done',        color: '#10B981' },
        ],
        transitions: [
          { from: 'backlog',     to: ['in_progress'] },
          { from: 'in_progress', to: ['in_review', 'backlog'] },
          { from: 'in_review',   to: ['done', 'in_progress'] },
          { from: 'done',        to: ['in_progress'] },
        ],
      },
    },
    priority: {
      type: 'picklist',
      label: 'Priority',
      required: true,
      defaultValue: 'medium',
      options: [
        { value: 'low',    label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high',   label: 'High' },
      ],
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
      name: 'Feature',
      fields: ['milestoneId', 'name', 'description', 'assigneeId', 'status', 'priority'],
    },
  ],
});
