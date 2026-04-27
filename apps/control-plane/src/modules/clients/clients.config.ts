import { defineEntity } from '@packages/entity-engine';
import { clients } from './schema/clients';

export const CLIENTS_CONFIG = defineEntity({
  table: clients,
  slug: 'clients',
  singularName: 'Client',
  pluralName: 'Clients',
  timestamps: true,

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
    },
    email: {
      type: 'email',
      label: 'Email',
      searchable: true,
      listVisible: true,
      listOrder: 2,
    },
  },

  defaultSort: 'name',

  sections: [
    {
      name: 'Client Details',
      fields: ['name', 'email'],
    },
  ],
});
