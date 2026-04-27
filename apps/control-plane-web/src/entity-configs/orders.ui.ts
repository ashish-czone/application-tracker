import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const ORDERS_UI_CONFIG: EntityUIConfig = {
  entityType: 'orders',
  presentation: {
    icon: 'ShoppingCart',
    navGroup: 'main',
    createMode: 'page',
  },
};

export const SUBSCRIPTION_PLANS_UI_CONFIG: EntityUIConfig = {
  entityType: 'subscription-plans',
  presentation: {
    icon: 'CreditCard',
    navGroup: 'billing',
    createMode: 'page',
  },
};

export const SUBSCRIPTIONS_UI_CONFIG: EntityUIConfig = {
  entityType: 'subscriptions',
  presentation: {
    icon: 'RefreshCw',
    navGroup: 'billing',
    createMode: 'page',
  },
};

export const ordersEntityUIConfigs: EntityUIConfig[] = [
  ORDERS_UI_CONFIG,
  SUBSCRIPTION_PLANS_UI_CONFIG,
  SUBSCRIPTIONS_UI_CONFIG,
];
