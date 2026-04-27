import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const LAWS_UI_CONFIG: EntityUIConfig = {
  entityType: 'laws',
  presentation: {
    icon: 'Scale',
    navGroup: 'compliance',
    navOrder: 1,
    createMode: 'modal',
  },
};
