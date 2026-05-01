import { defineEntity } from '@packages/entity-engine';
import { projects } from '../schema/projects';

export const PROJECTS_CONFIG = defineEntity({
  table: projects,
  slug: 'projects',
  timestamps: true,
  subtitleField: 'description',
  // Required for the platform's seed service to write workflow rows to the
  // workflow_definitions / workflow_states / workflow_transitions tables.
  // resolveForTransition() looks them up there at request time, so without
  // this flag the status transition endpoint 400s with "no workflow found".
  adminConfigurable: true,

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    slug: {
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
    },
    description: {
      type: 'textarea',
      label: 'Description',
    },
    ownerId: {
      type: 'user',
      label: 'Owner',
      isRecipient: true,
      listVisible: true,
      listOrder: 3,
    },
    status: {
      // Plain text from the engine's perspective; the workflow def lives in
      // projects.workflow.ts and is registered via WorkflowsModule.forFeature.
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
    color: {
      type: 'text',
      label: 'Color',
    },
    icon: {
      type: 'text',
      label: 'Icon',
    },
    startDate: {
      type: 'date',
      label: 'Start Date',
      sortable: true,
    },
    targetDate: {
      type: 'date',
      label: 'Target Date',
      sortable: true,
      listVisible: true,
      listOrder: 6,
    },
  },

  defaultSort: 'targetDate',

  sections: [
    {
      name: 'Project',
      fields: ['name', 'slug', 'description', 'ownerId', 'status', 'priority', 'startDate', 'targetDate'],
    },
    {
      name: 'Appearance',
      fields: ['color', 'icon'],
    },
  ],
});
