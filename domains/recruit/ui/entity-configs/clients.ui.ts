import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const CLIENTS_UI_CONFIG: EntityUIConfig = {
  entityType: 'clients',
  presentation: {
    icon: 'building-2',
    navGroup: 'recruit',
    navOrder: 4,
  },
  fieldUI: {
    clientName: { cellRenderer: 'AvatarNameCell' },
  },
};
