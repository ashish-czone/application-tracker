import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const CONTACTS_UI_CONFIG: EntityUIConfig = {
  entityType: 'contacts',
  presentation: {
    icon: 'contact',
    navGroup: 'recruit',
    navOrder: 5,
  },
  fieldUI: {
    fullName: { cellRenderer: 'AvatarNameCell' },
  },
};
