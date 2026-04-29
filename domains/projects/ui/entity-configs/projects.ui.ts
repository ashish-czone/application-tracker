import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const PROJECTS_UI_CONFIG: EntityUIConfig = {
  entityType: 'projects',
  presentation: {
    singularName: 'Project',
    pluralName: 'Projects',
    subtitleField: 'description',
    icon: 'FolderKanban',
    navGroup: 'Projects',
    navOrder: 1,
    createMode: 'modal',
  },
  fieldUI: {
    name: { label: 'Name' },
    slug: { label: 'Slug' },
    description: { label: 'Description' },
    ownerId: { label: 'Owner' },
    status: { label: 'Status', cellRenderer: 'PipelineProgressRenderer' },
    priority: { label: 'Priority' },
    color: { label: 'Color' },
    icon: { label: 'Icon' },
    startDate: { label: 'Start Date' },
    targetDate: { label: 'Target Date' },
  },
  formLayout: {
    sections: [
      { name: 'Project', fields: ['name', 'slug', 'description', 'ownerId', 'status', 'priority', 'startDate', 'targetDate'] },
      { name: 'Appearance', fields: ['color', 'icon'] },
    ],
    quickCreateFields: ['name'],
  },
  listColumns: [
    { fieldKey: 'name', visible: true, order: 1 },
    { fieldKey: 'slug', visible: true, order: 2 },
    { fieldKey: 'ownerId', visible: true, order: 3 },
    { fieldKey: 'status', visible: true, order: 4 },
    { fieldKey: 'priority', visible: true, order: 5 },
    { fieldKey: 'targetDate', visible: true, order: 6 },
  ],
};
