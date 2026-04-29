import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const LAW_HANDLERS_UI_CONFIG: EntityUIConfig = {
  entityType: 'law-handlers',
  presentation: {
    singularName: 'Law Handler',
    pluralName: 'Law Handlers',
    icon: 'Users',
    navGroup: 'compliance',
    navOrder: 4,
    createMode: 'modal',
  },
  fieldUI: {
    lawId: { label: 'Law' },
    orgEntityId: { label: 'Handler Org Unit' },
    clientId: { label: 'Client (optional override)' },
    isPrimary: { label: 'Primary Handler' },
  },
  formLayout: {
    sections: [
      { name: 'Handler', fields: ['lawId', 'orgEntityId', 'clientId', 'isPrimary'] },
    ],
  },
  listColumns: [
    { fieldKey: 'lawId', visible: true, order: 1 },
    { fieldKey: 'orgEntityId', visible: true, order: 2 },
    { fieldKey: 'clientId', visible: true, order: 3 },
    { fieldKey: 'isPrimary', visible: true, order: 4 },
  ],
};
