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
    status: { cellRenderer: 'PipelineProgressRenderer' },
  },
};
