import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const TASKS_UI_CONFIG: EntityUIConfig = {
  entityType: 'tasks',
  presentation: {
    icon: 'CheckSquare',
    navGroup: 'Projects',
    navOrder: 4,
    createMode: 'modal',
  },
  fieldUI: {
    // Custom renderer registered by domains/projects-ui via WebShell.
    // Replaces the default pipeline visual with a clickable status badge
    // whose dropdown commits a workflow transition inline.
    status: { cellRenderer: 'TaskStatusInline' },
  },
};
