import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const CLIENT_CONTACTS_UI_CONFIG: EntityUIConfig = {
  entityType: 'client-contacts',
  presentation: {
    singularName: 'Contact',
    pluralName: 'Contacts',
    icon: 'User',
    createMode: 'modal',
  },
  fieldUI: {
    clientId: { label: 'Client' },
    name: { label: 'Name' },
    email: { label: 'Email' },
    phone: { label: 'Phone' },
    designation: { label: 'Designation' },
    isPrimary: { label: 'Primary Contact' },
    notes: { label: 'Notes' },
  },
  formLayout: {
    sections: [
      { name: 'Contact', fields: ['clientId', 'name', 'email', 'phone', 'designation', 'isPrimary', 'notes'] },
    ],
  },
  listColumns: [
    { fieldKey: 'clientId', visible: true, order: 1 },
    { fieldKey: 'name', visible: true, order: 2 },
    { fieldKey: 'email', visible: true, order: 3 },
    { fieldKey: 'designation', visible: true, order: 4 },
    { fieldKey: 'isPrimary', visible: true, order: 5 },
  ],
};
