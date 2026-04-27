import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const USERS_UI_CONFIG: EntityUIConfig = {
  entityType: 'users',
  presentation: {
    icon: 'User',
    navGroup: 'admin',
    navOrder: 10,
    createMode: 'page',
  },
  fieldUI: {
    password: { uiType: 'password' },
  },
};
