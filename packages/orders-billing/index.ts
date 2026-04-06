// Module
export { OrdersBillingModule } from './orders-billing.module';

// Entity config
export { ORDERS_CONFIG } from './orders.config';

// Schema
export { orders, orderLineItems } from './schema';

// Services
export { OrderLifecycleService } from './services/order-lifecycle.service';
export { OrderLineItemsService } from './services/order-line-items.service';

// Registries
export { ProductResolverRegistry } from './services/product-resolver-registry';
export { BillingClientResolverRegistry } from './services/billing-client-resolver-registry';
export { OrderLifecycleHookRegistry } from './services/order-lifecycle-hook-registry';

// Types
export type {
  Product,
  ProductResolver,
  BillingClient,
  BillingClientResolver,
  OrderLifecycleHooks,
  CreateOrderInput,
  CreateLineItemInput,
  AddLineItemInput,
  OrderRecord,
  OrderLineItemRecord,
  OrderStatus,
  OrderCreatedPayload,
  OrderCreatedEvent,
} from './types';

// Constants
export { ORDER_STATUS, ORDERS_ORDER_CREATED } from './types';
