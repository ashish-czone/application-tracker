import { defineEntity } from '@packages/entity-engine';
import { clientContacts } from './client-contacts.schema';

export const CLIENT_CONTACTS_CONFIG = defineEntity({
  table: clientContacts,
  slug: 'client-contacts',
  timestamps: true,

  // Permissions live in client-contacts.permissions.ts; registered via
  // RbacIntegrationModule.forFeature in client-contacts.module.ts.
  skipAutoRegistration: { permissions: true },

  fields: {
    complianceClientId: {
      type: 'lookup',
      label: 'Client',
      entity: 'clients',
      required: true,
      listVisible: true,
      listOrder: 1,
    },
    fullName: {
      type: 'text',
      label: 'Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 2,
    },
    primaryEmail: {
      type: 'email',
      label: 'Email',
      listVisible: true,
      listOrder: 3,
    },
    primaryPhone: {
      type: 'phone',
      label: 'Phone',
    },
    complianceDesignation: {
      type: 'text',
      label: 'Designation',
      listVisible: true,
      listOrder: 4,
    },
    complianceIsPrimary: {
      type: 'boolean',
      label: 'Primary Contact',
      defaultValue: 'false',
      listVisible: true,
      listOrder: 5,
    },
    complianceNotes: {
      type: 'textarea',
      label: 'Notes',
    },
  },

  defaultSort: 'fullName',

  sections: [
    {
      name: 'Contact',
      fields: ['complianceClientId', 'fullName', 'primaryEmail', 'primaryPhone', 'complianceDesignation', 'complianceIsPrimary', 'complianceNotes'],
    },
  ],
});
