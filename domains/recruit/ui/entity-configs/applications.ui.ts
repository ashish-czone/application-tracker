import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const APPLICATIONS_UI_CONFIG: EntityUIConfig = {
  entityType: 'applications',
  presentation: {
    icon: 'file-text',
    navGroup: 'recruit',
    navOrder: 3,
  },
  fieldUI: {
    stage: { cellRenderer: 'PipelineProgressRenderer' },
    averageRating: { cellRenderer: 'RatingRenderer' },
  },
};
