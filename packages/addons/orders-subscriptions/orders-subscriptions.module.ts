import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { EventRegistryService } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { RbacService } from '@packages/rbac';
import { QueueService } from '@packages/queue';
import { ProductResolverRegistry } from '@packages/orders-billing';
import { cronForLocalHour } from '@packages/common';
import { PlanProductResolver } from './services/plan-product-resolver';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { SubscriptionQueryService } from './services/subscription-query.service';
import { SubscriptionExpiryProcessor } from './services/subscription-expiry.processor';
import {
  SUBSCRIPTIONS_ACTIVATED,
  SUBSCRIPTIONS_RENEWED,
  SUBSCRIPTIONS_CANCELLED,
  SUBSCRIPTIONS_PAUSED,
  SUBSCRIPTIONS_RESUMED,
} from './types';

export const SUBSCRIPTION_EXPIRY_QUEUE = 'subscriptions.expiry-check';

@Global()
@Module({
  providers: [
    PlanProductResolver,
    SubscriptionLifecycleService,
    SubscriptionQueryService,
    SubscriptionExpiryProcessor,
  ],
  exports: [
    PlanProductResolver,
    SubscriptionLifecycleService,
    SubscriptionQueryService,
  ],
})
export class OrdersSubscriptionsModule implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly eventRegistry: EventRegistryService,
    private readonly rbacService: RbacService,
    private readonly productResolverRegistry: ProductResolverRegistry,
    private readonly planProductResolver: PlanProductResolver,
    private readonly queueService: QueueService,
    private readonly expiryProcessor: SubscriptionExpiryProcessor,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(OrdersSubscriptionsModule.name);
  }

  async onModuleInit() {
    // 1. Register plan product resolver with orders-billing
    this.productResolverRegistry.register('subscription-plan', this.planProductResolver);

    // 2. Register domain events
    this.eventRegistry.register({
      eventName: SUBSCRIPTIONS_ACTIVATED,
      group: 'subscriptions',
      description: 'Fired when a subscription is activated',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: SUBSCRIPTIONS_RENEWED,
      group: 'subscriptions',
      description: 'Fired when a subscription is renewed (period extended)',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: SUBSCRIPTIONS_CANCELLED,
      group: 'subscriptions',
      description: 'Fired when a subscription is cancelled',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: SUBSCRIPTIONS_PAUSED,
      group: 'subscriptions',
      description: 'Fired when a subscription is paused',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: SUBSCRIPTIONS_RESUMED,
      group: 'subscriptions',
      description: 'Fired when a subscription is resumed',
      payloadSchema: {},
    });

    // 3. Register RBAC permissions (beyond auto-generated CRUD from entity engine)
    this.rbacService.registerPermissions('subscriptions', [
      { action: 'activate', description: 'Activate subscriptions' },
      { action: 'renew', description: 'Renew subscriptions' },
      { action: 'cancel', description: 'Cancel subscriptions' },
      { action: 'pause', description: 'Pause subscriptions' },
    ]);

    // 4. Register expiry cron job (daily at 1:00 AM local time)
    this.queueService.registerProcessor({
      name: SUBSCRIPTION_EXPIRY_QUEUE,
      handler: async () => {
        await this.expiryProcessor.processExpiredSubscriptions();
      },
    });

    const queue = this.queueService.getQueue(SUBSCRIPTION_EXPIRY_QUEUE);
    if (queue) {
      const appTimezone = process.env.APP_TIMEZONE ?? 'UTC';
      const cronPattern = cronForLocalHour(1, appTimezone);
      try {
        await queue.upsertJobScheduler(
          'subscription-expiry-check',
          { pattern: cronPattern },
          { name: SUBSCRIPTION_EXPIRY_QUEUE, data: {} },
        );
        this.logger.log(`Subscription expiry check registered (${cronPattern}, 1:00 AM ${appTimezone})`);
      } catch (err) {
        this.logger.error('Failed to register subscription expiry scheduler', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
