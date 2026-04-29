import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const TASKS_UI_CONFIG: EntityUIConfig = {
  entityType: 'tasks',
  presentation: {
    singularName: 'Task',
    pluralName: 'Tasks',
    icon: 'CheckSquare',
    navGroup: 'Projects',
    navOrder: 4,
    createMode: 'modal',
  },
  fieldUI: {
    featureId: { label: 'Feature' },
    title: { label: 'Title' },
    description: { label: 'Description' },
    assigneeId: { label: 'Assignee' },
    // Custom renderer registered by domains/projects-ui via WebShell.
    // Replaces the default pipeline visual with a clickable status badge
    // whose dropdown commits a workflow transition inline.
    status: { label: 'Status', cellRenderer: 'TaskStatusInline' },
    dueDate: { label: 'Due Date' },
    completedAt: { label: 'Completed At' },
  },
  formLayout: {
    sections: [
      { name: 'Task', fields: ['featureId', 'title', 'description', 'assigneeId', 'status', 'dueDate'] },
    ],
    quickCreateFields: ['title'],
  },
  listColumns: [
    { fieldKey: 'featureId', visible: true, order: 1 },
    { fieldKey: 'title', visible: true, order: 2 },
    { fieldKey: 'assigneeId', visible: true, order: 3 },
    { fieldKey: 'status', visible: true, order: 4 },
    { fieldKey: 'dueDate', visible: true, order: 5 },
  ],
};
