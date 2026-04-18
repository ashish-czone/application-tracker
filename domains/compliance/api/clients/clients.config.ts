import { defineEntity } from '@packages/entity-engine';
import { clients } from '../schema/clients';

export const CLIENTS_CONFIG = defineEntity({
  table: clients,
  slug: 'clients',
  singularName: 'Client',
  pluralName: 'Clients',
  softDelete: false,
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
    legalName: {
      type: 'text',
      label: 'Legal Name',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
    },
    email: {
      type: 'email',
      label: 'Email',
      listVisible: true,
      listOrder: 3,
    },
    taxId: {
      type: 'text',
      label: 'Tax ID',
      unique: true,
      searchable: true,
      listVisible: true,
      listOrder: 4,
    },
  },

  defaultSort: 'name',

  sections: [
    {
      name: 'Client',
      fields: ['name', 'legalName', 'email', 'taxId'],
    },
  ],

  ui: {
    icon: 'Building2',
    navGroup: 'compliance',
    navOrder: 2,
    createMode: 'modal',
  },
});
