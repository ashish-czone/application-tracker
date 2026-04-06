import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { EventRegistryService } from '@packages/events';
import { ProductResolverRegistry } from './services/product-resolver-registry';
import { BillingClientResolverRegistry } from './services/billing-client-resolver-registry';
import { OrderLifecycleHookRegistry } from './services/order-lifecycle-hook-registry';
import { OrderLineItemsService } from './services/order-line-items.service';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { ORDERS_ORDER_CREATED } from './types';

@Global()
@Module({
  providers: [
    ProductResolverRegistry,
    BillingClientResolverRegistry,
    OrderLifecycleHookRegistry,
    OrderLineItemsService,
    OrderLifecycleService,
  ],
  exports: [
    ProductResolverRegistry,
    BillingClientResolverRegistry,
    OrderLifecycleHookRegistry,
    OrderLineItemsService,
    OrderLifecycleService,
  ],
})
export class OrdersBillingModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistryService,
  ) {}

  onModuleInit() {
    this.eventRegistry.register({
      eventName: ORDERS_ORDER_CREATED,
      group: 'orders',
      description: 'Fired when a new order is created via OrderLifecycleService',
      payloadSchema: {},
    });
  }
}
