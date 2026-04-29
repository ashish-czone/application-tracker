import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const MILESTONES_UI_CONFIG: EntityUIConfig = {
  entityType: 'milestones',
  presentation: {
    singularName: 'Milestone',
    pluralName: 'Milestones',
    icon: 'Flag',
    navGroup: 'Projects',
    navOrder: 2,
    createMode: 'modal',
  },
  fieldUI: {
    projectId: { label: 'Project' },
    name: { label: 'Name' },
    description: { label: 'Description' },
    status: { label: 'Status', cellRenderer: 'PipelineProgressRenderer' },
    dueDate: { label: 'Due Date' },
    completedAt: { label: 'Completed At' },
  },
  formLayout: {
    sections: [
      { name: 'Milestone', fields: ['projectId', 'name', 'description', 'status', 'dueDate'] },
    ],
    quickCreateFields: ['name'],
  },
  listColumns: [
    { fieldKey: 'projectId', visible: true, order: 1 },
    { fieldKey: 'name', visible: true, order: 2 },
    { fieldKey: 'status', visible: true, order: 3 },
    { fieldKey: 'dueDate', visible: true, order: 4 },
  ],
};
