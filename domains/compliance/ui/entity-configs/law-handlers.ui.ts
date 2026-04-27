import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const LAW_HANDLERS_UI_CONFIG: EntityUIConfig = {
  entityType: 'law-handlers',
  presentation: {
    icon: 'Users',
    navGroup: 'compliance',
    navOrder: 4,
    createMode: 'modal',
  },
};
