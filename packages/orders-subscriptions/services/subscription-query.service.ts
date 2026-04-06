import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, isNull, desc } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { subscriptions } from '../schema/subscriptions';
import {
  SUBSCRIPTION_STATUS,
  type SubscriptionRecord,
  type AggregatedCapabilities,
} from '../types';

@Injectable()
export class SubscriptionQueryService {
  constructor(private readonly database: DatabaseService) {}

  async getActiveSubscriptions(clientId: string): Promise<SubscriptionRecord[]> {
    return this.database.db
      .select()
      .from(subscriptions)
      .where(
        withTenant(
          subscriptions,
          eq(subscriptions.clientId, clientId),
          eq(subscriptions.status, SUBSCRIPTION_STATUS.ACTIVE),
          isNull(subscriptions.deletedAt),
        ),
      );
  }

  async getActiveCapabilities(clientId: string): Promise<AggregatedCapabilities> {
    const active = await this.getActiveSubscriptions(clientId);

    const capabilities: Record<string, boolean | string | number> = {};
    const limits: Record<string, number> = {};

    for (const sub of active) {
      const snapshot = sub.planSnapshot as Record<string, unknown>;
      const planCaps = (snapshot.capabilities ?? {}) as Record<string, boolean | string | number>;
      const planLimits = (snapshot.limits ?? {}) as Record<string, number>;

      for (const [key, value] of Object.entries(planCaps)) {
        if (typeof value === 'boolean') {
          capabilities[key] = (capabilities[key] as boolean) || value;
        } else if (typeof value === 'number') {
          capabilities[key] = Math.max((capabilities[key] as number) ?? 0, value);
        } else {
          capabilities[key] = value;
        }
      }

      for (const [key, value] of Object.entries(planLimits)) {
        limits[key] = Math.max(limits[key] ?? 0, value);
      }
    }

    return { capabilities, limits };
  }

  async hasCapability(clientId: string, capability: string): Promise<boolean> {
    const { capabilities } = await this.getActiveCapabilities(clientId);
    return !!capabilities[capability];
  }

  async getSubscriptionsByClientId(clientId: string): Promise<SubscriptionRecord[]> {
    return this.database.db
      .select()
      .from(subscriptions)
      .where(
        withTenant(
          subscriptions,
          eq(subscriptions.clientId, clientId),
          isNull(subscriptions.deletedAt),
        ),
      )
      .orderBy(desc(subscriptions.createdAt));
  }
}
