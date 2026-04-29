import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const FEATURES_UI_CONFIG: EntityUIConfig = {
  entityType: 'features',
  presentation: {
    singularName: 'Feature',
    pluralName: 'Features',
    icon: 'Sparkles',
    navGroup: 'Projects',
    navOrder: 3,
    createMode: 'modal',
  },
  fieldUI: {
    milestoneId: { label: 'Milestone' },
    name: { label: 'Name' },
    description: { label: 'Description' },
    assigneeId: { label: 'Assignee' },
    status: { label: 'Status', cellRenderer: 'PipelineProgressRenderer' },
    priority: { label: 'Priority' },
    completedAt: { label: 'Completed At' },
  },
  formLayout: {
    sections: [
      { name: 'Feature', fields: ['milestoneId', 'name', 'description', 'assigneeId', 'status', 'priority'] },
    ],
    quickCreateFields: ['name'],
  },
  listColumns: [
    { fieldKey: 'milestoneId', visible: true, order: 1 },
    { fieldKey: 'name', visible: true, order: 2 },
    { fieldKey: 'assigneeId', visible: true, order: 3 },
    { fieldKey: 'status', visible: true, order: 4 },
    { fieldKey: 'priority', visible: true, order: 5 },
  ],
};
