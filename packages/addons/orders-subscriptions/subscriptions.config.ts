import { defineEntity } from '@packages/entity-engine';
import { subscriptions } from './schema/subscriptions';

export const SUBSCRIPTIONS_CONFIG = defineEntity({
  table: subscriptions,
  slug: 'subscriptions',
  singularName: 'Subscription',
  pluralName: 'Subscriptions',
  timestamps: true,

  fields: {
    clientId: {
      type: 'text',
      label: 'Client',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 1,
    },
    clientType: {
      type: 'text',
      label: 'Client Type',
    },
    planId: {
      type: 'lookup',
      label: 'Plan',
      entity: 'subscription-plans',
      required: true,
      listVisible: true,
      listOrder: 2,
    },
    status: {
      type: 'workflow',
      label: 'Status',
      system: true,
      sortable: true,
      listVisible: true,
      listOrder: 3,
      workflow: {
        slug: 'subscription-status',
        initialState: 'pending_activation',
        states: [
          { name: 'pending_activation', label: 'Pending Activation', color: '#F59E0B' },
          { name: 'active', label: 'Active', color: '#10B981' },
          { name: 'paused', label: 'Paused', color: '#6366F1' },
          { name: 'expired', label: 'Expired', color: '#9CA3AF' },
          { name: 'cancelled', label: 'Cancelled', color: '#EF4444' },
        ],
        transitions: [
          { from: 'pending_activation', to: ['active', 'cancelled'] },
          { from: 'active', to: ['paused', 'expired', 'cancelled'] },
          { from: 'paused', to: ['active', 'cancelled'] },
        ],
      },
    },
    currentPeriodStart: {
      type: 'datetime',
      label: 'Period Start',
      sortable: true,
      listVisible: true,
      listOrder: 4,
    },
    currentPeriodEnd: {
      type: 'datetime',
      label: 'Period End',
      sortable: true,
      listVisible: true,
      listOrder: 5,
    },
    autoRenew: {
      type: 'boolean',
      label: 'Auto Renew',
      listVisible: true,
      listOrder: 6,
    },
    cancelledAt: {
      type: 'datetime',
      label: 'Cancelled At',
    },
  },

  defaultSort: 'createdAt',

  sections: [
    {
      name: 'Subscription Details',
      fields: ['clientId', 'clientType', 'planId', 'status', 'currentPeriodStart', 'currentPeriodEnd', 'autoRenew', 'cancelledAt'],
    },
  ],
});
