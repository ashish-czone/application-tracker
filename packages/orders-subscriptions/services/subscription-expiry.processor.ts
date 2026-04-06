import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, isNull, lt } from '@packages/database';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { withTenant } from '@packages/tenancy/helpers';
import { subscriptions } from '../schema/subscriptions';
import { SUBSCRIPTION_STATUS } from '../types';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

@Injectable()
export class SubscriptionExpiryProcessor {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly lifecycleService: SubscriptionLifecycleService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(SubscriptionExpiryProcessor.name);
  }

  async processExpiredSubscriptions(): Promise<void> {
    const now = new Date();

    const expired = await this.database.db
      .select()
      .from(subscriptions)
      .where(
        withTenant(
          subscriptions,
          eq(subscriptions.status, SUBSCRIPTION_STATUS.ACTIVE),
          lt(subscriptions.currentPeriodEnd, now),
          isNull(subscriptions.deletedAt),
        ),
      );

    this.logger.log(`Found ${expired.length} expired subscriptions to process`);

    for (const sub of expired) {
      try {
        await this.lifecycleService.expireSubscription(sub.id, 'system');
      } catch (error) {
        this.logger.error(`Failed to expire subscription ${sub.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
