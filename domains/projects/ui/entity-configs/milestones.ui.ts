import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const MILESTONES_UI_CONFIG: EntityUIConfig = {
  entityType: 'milestones',
  presentation: {
    icon: 'Flag',
    navGroup: 'Projects',
    navOrder: 2,
    createMode: 'modal',
  },
  fieldUI: {
    status: { cellRenderer: 'PipelineProgressRenderer' },
  },
};
