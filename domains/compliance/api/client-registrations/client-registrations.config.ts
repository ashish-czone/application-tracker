import { defineEntity } from '@packages/entity-engine';
import { complianceClientRegistrations } from '../schema/client-registrations';

export const CLIENT_REGISTRATIONS_CONFIG = defineEntity({
  table: complianceClientRegistrations,
  slug: 'client-registrations',
  singularName: 'Registration',
  pluralName: 'Registrations',
  softDelete: false,
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
    lawId: {
      type: 'lookup',
      label: 'Law',
      entity: 'laws',
      required: true,
      listVisible: true,
      listOrder: 2,
    },
    registeredAt: {
      type: 'datetime',
      label: 'Registered At',
      listVisible: true,
      listOrder: 3,
    },
    deactivatedAt: {
      type: 'datetime',
      label: 'Deactivated At',
      listVisible: true,
      listOrder: 4,
    },
  },

  defaultSort: '-registeredAt',

  sections: [
    {
      name: 'Registration',
      fields: ['clientId', 'lawId', 'registeredAt', 'deactivatedAt'],
    },
  ],

  ui: {
    icon: 'FileBadge',
    // Registrations are managed within the client detail page; not shown
    // in top-level navigation. navGroup is intentionally omitted.
    createMode: 'modal',
  },
});
