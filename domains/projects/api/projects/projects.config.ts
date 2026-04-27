import { defineEntity } from '@packages/entity-engine';
import { projects } from '../schema/projects';

export const PROJECTS_CONFIG = defineEntity({
  table: projects,
  slug: 'projects',
  singularName: 'Project',
  pluralName: 'Projects',
  timestamps: true,
  subtitleField: 'description',

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
      type: 'workflow',
      label: 'Status',
      sortable: true,
      listVisible: true,
      listOrder: 4,
      cellRenderer: 'PipelineProgressRenderer',
      workflow: {
        slug: 'project-status',
        initialState: 'planning',
        states: [
          { name: 'planning',  label: 'Planning',  color: '#6B7280' },
          { name: 'active',    label: 'Active',    color: '#10B981' },
          { name: 'on_hold',   label: 'On Hold',   color: '#F59E0B' },
          { name: 'completed', label: 'Completed', color: '#3B82F6' },
        ],
        transitions: [
          { from: 'planning',  to: ['active'] },
          { from: 'active',    to: ['on_hold', 'completed'] },
          { from: 'on_hold',   to: ['active'] },
          { from: 'completed', to: ['active'] },
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
