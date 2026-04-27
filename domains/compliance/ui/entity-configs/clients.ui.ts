import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const CLIENTS_UI_CONFIG: EntityUIConfig = {
  entityType: 'clients',
  presentation: {
    icon: 'Building2',
    navGroup: 'compliance',
    navOrder: 2,
    createMode: 'modal',
  },
};
