import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const MENUS_UI_CONFIG: EntityUIConfig = {
  entityType: 'menus',
  presentation: {
    icon: 'Menu',
    navGroup: 'Content',
    createMode: 'modal',
    afterCreateRoute: '/menus/:id/edit',
  },
};
