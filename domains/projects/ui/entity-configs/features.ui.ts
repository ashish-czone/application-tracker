import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const FEATURES_UI_CONFIG: EntityUIConfig = {
  entityType: 'features',
  presentation: {
    icon: 'Sparkles',
    navGroup: 'Projects',
    navOrder: 3,
    createMode: 'modal',
  },
  fieldUI: {
    status: { cellRenderer: 'PipelineProgressRenderer' },
  },
};
