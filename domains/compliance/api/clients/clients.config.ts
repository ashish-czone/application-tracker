import { defineEntity } from '@packages/entity-engine';
import { complianceClients } from '../schema/clients';

export const CLIENTS_CONFIG = defineEntity({
  table: complianceClients,
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
      searchable: true,
      listVisible: true,
      listOrder: 2,
    },
    primaryContactEmail: {
      type: 'email',
      label: 'Primary Contact Email',
      listVisible: true,
      listOrder: 3,
    },
    taxIdentifier: {
      type: 'text',
      label: 'Tax Identifier',
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
      fields: ['name', 'legalName', 'primaryContactEmail', 'taxIdentifier'],
    },
  ],

  ui: {
    icon: 'Building2',
    navGroup: 'compliance',
    navOrder: 2,
    createMode: 'modal',
  },
});
