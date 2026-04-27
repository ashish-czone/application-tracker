import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const USERS_UI_CONFIG: EntityUIConfig = {
  entityType: 'users',
  presentation: {
    icon: 'User',
    subtitleField: 'email',
    navGroup: 'admin',
    navOrder: 10,
    createMode: 'page',
  },
  fieldUI: {
    password: { uiType: 'password' },
  },
};
