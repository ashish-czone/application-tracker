import { defineEntity } from '@packages/entity-engine';
import { orders } from './schema/orders';

export const ORDERS_CONFIG = defineEntity({
  table: orders,
  slug: 'orders',
  singularName: 'Order',
  pluralName: 'Orders',
  timestamps: true,

  fields: {
    orderNumber: {
      type: 'text',
      label: 'Order Number',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      readonly: true,
      system: true,
      listVisible: true,
      listOrder: 1,
    },
    status: {
      type: 'workflow',
      label: 'Status',
      system: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
      workflow: {
        slug: 'order-status',
        initialState: 'draft',
        states: [
          { name: 'draft', label: 'Draft', color: '#6B7280' },
          { name: 'pending', label: 'Pending', color: '#F59E0B' },
          { name: 'active', label: 'Active', color: '#3B82F6' },
          { name: 'completed', label: 'Completed', color: '#10B981' },
          { name: 'cancelled', label: 'Cancelled', color: '#EF4444' },
          { name: 'expired', label: 'Expired', color: '#9CA3AF' },
          { name: 'refunded', label: 'Refunded', color: '#8B5CF6' },
        ],
        transitions: [
          { from: 'draft', to: ['pending', 'cancelled'] },
          { from: 'pending', to: ['active', 'cancelled'] },
          { from: 'active', to: ['completed', 'cancelled', 'expired', 'refunded'] },
          { from: 'completed', to: ['refunded'] },
        ],
      },
    },
    clientId: {
      type: 'text',
      label: 'Client',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 3,
    },
    clientType: {
      type: 'text',
      label: 'Client Type',
    },
    totalAmount: {
      type: 'currency',
      label: 'Total Amount',
      sortable: true,
      readonly: true,
      system: true,
      listVisible: true,
      listOrder: 4,
    },
    currency: {
      type: 'text',
      label: 'Currency',
      required: true,
      listVisible: true,
      listOrder: 5,
    },
    notes: {
      type: 'textarea',
      label: 'Notes',
    },
    expiresAt: {
      type: 'datetime',
      label: 'Expires At',
      sortable: true,
    },
    createdBy: {
      type: 'user',
      label: 'Created By',
      system: true,
      readonly: true,
    },
  },

  defaultSort: 'createdAt',

  sections: [
    {
      name: 'Order Details',
      fields: ['orderNumber', 'status', 'clientId', 'clientType', 'totalAmount', 'currency', 'notes', 'expiresAt'],
    },
  ],
});
