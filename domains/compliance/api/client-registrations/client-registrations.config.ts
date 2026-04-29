import { defineEntity } from '@packages/entity-engine';
import { complianceClientRegistrations } from '../schema/client-registrations';

export const CLIENT_REGISTRATIONS_CONFIG = defineEntity({
  table: complianceClientRegistrations,
  slug: 'client-registrations',
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
    registrationNumber: {
      type: 'text',
      label: 'Registration Number',
      listVisible: true,
      listOrder: 3,
    },
    effectiveFrom: {
      type: 'date',
      label: 'Effective From',
      listVisible: true,
      listOrder: 4,
    },
    registeredAt: {
      type: 'datetime',
      label: 'Registered At',
      listVisible: true,
      listOrder: 5,
    },
    deactivatedAt: {
      type: 'datetime',
      label: 'Deactivated At',
      listVisible: true,
      listOrder: 6,
    },
  },

  defaultSort: '-registeredAt',

  sections: [
    {
      name: 'Registration',
      fields: ['clientId', 'lawId', 'registrationNumber', 'effectiveFrom', 'registeredAt', 'deactivatedAt'],
    },
  ],
});
