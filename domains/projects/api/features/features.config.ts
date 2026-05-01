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
      // Plain text from the engine's perspective; the workflow def lives in
      // features.workflow.ts and is registered via WorkflowsModule.forFeature.
      type: 'text',
      label: 'Status',
      sortable: true,
      listVisible: true,
      listOrder: 4,
      cellRenderer: 'PipelineProgressRenderer',
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
