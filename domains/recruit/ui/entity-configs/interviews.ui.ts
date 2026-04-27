import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const INTERVIEWS_UI_CONFIG: EntityUIConfig = {
  entityType: 'interviews',
  presentation: {
    icon: 'calendar-check',
    navGroup: 'recruit',
    navOrder: 3,
  },
  fieldUI: {
    status: { cellRenderer: 'StatusBadge' },
  },
};
