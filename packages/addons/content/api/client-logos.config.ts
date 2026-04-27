import { defineEntity } from '@packages/entity-engine';
import { clientLogos } from './schema/client-logos';

export const CLIENT_LOGOS_CONFIG = defineEntity({
  table: clientLogos,
  slug: 'client-logos',
  singularName: 'Client Logo',
  pluralName: 'Client Logos',
  timestamps: true,
  adminConfigurable: true,

  fields: {
    name: {
      type: 'text',
      label: 'Client Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    logoUrl: {
      type: 'file',
      label: 'Logo',
      required: true,
      accept: ['image/*'],
    },
    href: {
      type: 'url',
      label: 'Link',
    },
    displayOrder: {
      type: 'number',
      label: 'Display Order',
      sortable: true,
    },
    isActive: {
      type: 'boolean',
      label: 'Active',
      listVisible: true,
      listOrder: 2,
    },
  },

  defaultSort: 'displayOrder',
});
