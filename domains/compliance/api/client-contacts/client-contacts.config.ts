import { defineEntity } from '@packages/entity-engine';
import { clientContacts } from '../schema/client-contacts';

export const CLIENT_CONTACTS_CONFIG = defineEntity({
  table: clientContacts,
  slug: 'client-contacts',
  singularName: 'Contact',
  pluralName: 'Contacts',
  timestamps: true,

  fields: {
    clientId: {
      type: 'lookup',
      label: 'Client',
      entity: 'clients',
      required: true,
      listVisible: true,
      listOrder: 1,
    },
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 2,
    },
    email: {
      type: 'email',
      label: 'Email',
      listVisible: true,
      listOrder: 3,
    },
    phone: {
      type: 'phone',
      label: 'Phone',
    },
    designation: {
      type: 'text',
      label: 'Designation',
      listVisible: true,
      listOrder: 4,
    },
    isPrimary: {
      type: 'boolean',
      label: 'Primary Contact',
      defaultValue: 'false',
      listVisible: true,
      listOrder: 5,
    },
    notes: {
      type: 'textarea',
      label: 'Notes',
    },
  },

  defaultSort: 'name',

  sections: [
    {
      name: 'Contact',
      fields: ['clientId', 'name', 'email', 'phone', 'designation', 'isPrimary', 'notes'],
    },
  ],

  ui: {
    icon: 'User',
    // Contacts are managed within the client detail page; not shown in
    // top-level navigation. navGroup is intentionally omitted.
    createMode: 'modal',
  },
});
