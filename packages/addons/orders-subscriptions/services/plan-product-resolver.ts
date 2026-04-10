import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, isNull } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import type { Product, ProductResolver } from '@packages/orders-billing';
import { subscriptionPlans } from '../schema/subscription-plans';

@Injectable()
export class PlanProductResolver implements ProductResolver {
  constructor(private readonly database: DatabaseService) {}

  async resolve(productId: string): Promise<Product | null> {
    const [plan] = await this.database.db
      .select()
      .from(subscriptionPlans)
      .where(
        withTenant(
          subscriptionPlans,
          eq(subscriptionPlans.id, productId),
          isNull(subscriptionPlans.deletedAt),
        ),
      )
      .limit(1);

    if (!plan) return null;

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? undefined,
      unitPrice: plan.price,
      currency: plan.currency,
      type: 'subscription-plan',
      metadata: {
        slug: plan.slug,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        capabilities: plan.capabilities,
        limits: plan.limits,
      },
    };
  }
}
