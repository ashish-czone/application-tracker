import { defineEntity } from '@packages/entity-engine';
import { subscriptionPlans } from './schema/subscription-plans';

export const SUBSCRIPTION_PLANS_CONFIG = defineEntity({
  table: subscriptionPlans,
  slug: 'subscription-plans',
  singularName: 'Subscription Plan',
  pluralName: 'Subscription Plans',
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
    slug: {
      type: 'text',
      label: 'Slug',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
    },
    description: {
      type: 'textarea',
      label: 'Description',
    },
    price: {
      type: 'currency',
      label: 'Price',
      sortable: true,
      listVisible: true,
      listOrder: 3,
    },
    currency: {
      type: 'text',
      label: 'Currency',
      required: true,
      listVisible: true,
      listOrder: 4,
    },
    interval: {
      type: 'picklist',
      label: 'Interval',
      sortable: true,
      listVisible: true,
      listOrder: 5,
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
        { label: 'One Time', value: 'one_time' },
      ],
    },
    intervalCount: {
      type: 'number',
      label: 'Interval Count',
    },
    isActive: {
      type: 'boolean',
      label: 'Active',
      sortable: true,
      listVisible: true,
      listOrder: 6,
    },
    sortOrder: {
      type: 'number',
      label: 'Sort Order',
      sortable: true,
    },
  },

  defaultSort: 'sortOrder',

  sections: [
    {
      name: 'Plan Details',
      fields: ['name', 'slug', 'description', 'price', 'currency', 'interval', 'intervalCount', 'isActive', 'sortOrder'],
    },
  ],

  ui: {
    icon: 'CreditCard',
    navGroup: 'billing',
    createMode: 'page',
  },
});
