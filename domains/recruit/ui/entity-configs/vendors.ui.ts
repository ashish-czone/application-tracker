import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const VENDORS_UI_CONFIG: EntityUIConfig = {
  entityType: 'vendors',
  presentation: {
    icon: 'store',
    navGroup: 'recruit',
    navOrder: 6,
  },
  fieldUI: {
    vendorName: { cellRenderer: 'AvatarNameCell' },
  },
};
