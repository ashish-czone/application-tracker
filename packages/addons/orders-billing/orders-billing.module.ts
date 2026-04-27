import { Module, type OnModuleInit } from '@nestjs/common';
import { EventRegistryService } from '@packages/events';
import { EntityEngineModule } from '@packages/entity-engine';
import { ORDERS_CONFIG } from './orders.config';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { ProductResolverRegistry } from './services/product-resolver-registry';
import { BillingClientResolverRegistry } from './services/billing-client-resolver-registry';
import { OrderLifecycleHookRegistry } from './services/order-lifecycle-hook-registry';
import { OrderLineItemsService } from './services/order-line-items.service';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { ORDERS_ORDER_CREATED } from './types';

@Module({
  imports: [EntityEngineModule.forEntity(ORDERS_CONFIG)],
  controllers: [OrdersController],
  providers: [
    ProductResolverRegistry,
    BillingClientResolverRegistry,
    OrderLifecycleHookRegistry,
    OrderLineItemsService,
    OrderLifecycleService,
    OrdersService,
  ],
  exports: [
    ProductResolverRegistry,
    BillingClientResolverRegistry,
    OrderLifecycleHookRegistry,
    OrderLineItemsService,
    OrderLifecycleService,
    OrdersService,
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
