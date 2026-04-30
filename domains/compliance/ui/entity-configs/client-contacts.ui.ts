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
    complianceClientId: { label: 'Client' },
    fullName: { label: 'Name' },
    primaryEmail: { label: 'Email' },
    primaryPhone: { label: 'Phone' },
    complianceDesignation: { label: 'Designation' },
    complianceIsPrimary: { label: 'Primary Contact' },
    complianceNotes: { label: 'Notes' },
  },
  formLayout: {
    sections: [
      { name: 'Contact', fields: ['complianceClientId', 'fullName', 'primaryEmail', 'primaryPhone', 'complianceDesignation', 'complianceIsPrimary', 'complianceNotes'] },
    ],
  },
  listColumns: [
    { fieldKey: 'complianceClientId', visible: true, order: 1 },
    { fieldKey: 'fullName', visible: true, order: 2 },
    { fieldKey: 'primaryEmail', visible: true, order: 3 },
    { fieldKey: 'complianceDesignation', visible: true, order: 4 },
    { fieldKey: 'complianceIsPrimary', visible: true, order: 5 },
  ],
};
