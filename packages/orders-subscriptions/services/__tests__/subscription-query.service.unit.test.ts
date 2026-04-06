import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionQueryService } from '../subscription-query.service';
import type { DatabaseService } from '@packages/database';
import type { SubscriptionRecord } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
}));

function createFakeSubscription(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: 'sub-1',
    clientId: 'client-1',
    clientType: null,
    planId: 'plan-1',
    planSnapshot: {
      capabilities: { api_access: true, automations: false },
      limits: { max_users: 50 },
    },
    orderId: null,
    orderLineItemId: null,
    status: 'active',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2026-02-01'),
    cancelledAt: null,
    autoRenew: true,
    metadata: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

function createMockDb(rows: any[] = []): DatabaseService {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
    // For getActiveSubscriptions which doesn't have orderBy
  };
  // Mock where to return rows directly for queries without orderBy
  chain.where = vi.fn().mockReturnValue({
    orderBy: vi.fn().mockResolvedValue(rows),
    then: (resolve: any) => resolve(rows),
    [Symbol.toStringTag]: 'Promise',
  });
  // Make it properly thenable
  const whereResult = {
    orderBy: vi.fn().mockResolvedValue(rows),
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(rows).catch(reject),
  };
  chain.where = vi.fn().mockReturnValue(whereResult);

  return { db: chain } as unknown as DatabaseService;
}

describe('SubscriptionQueryService', () => {
  describe('getActiveSubscriptions', () => {
    it('should return active subscriptions for a client', async () => {
      const subs = [createFakeSubscription()];
      const service = new SubscriptionQueryService(createMockDb(subs));

      const result = await service.getActiveSubscriptions('client-1');

      expect(result).toEqual(subs);
    });

    it('should return empty array when client has no active subscriptions', async () => {
      const service = new SubscriptionQueryService(createMockDb([]));

      const result = await service.getActiveSubscriptions('client-1');

      expect(result).toEqual([]);
    });
  });

  describe('getActiveCapabilities', () => {
    it('should aggregate capabilities from a single subscription', async () => {
      const subs = [createFakeSubscription()];
      const service = new SubscriptionQueryService(createMockDb(subs));

      const result = await service.getActiveCapabilities('client-1');

      expect(result.capabilities).toEqual({
        api_access: true,
        automations: false,
      });
      expect(result.limits).toEqual({ max_users: 50 });
    });

    it('should merge boolean capabilities with OR across subscriptions', async () => {
      const subs = [
        createFakeSubscription({
          id: 'sub-1',
          planSnapshot: {
            capabilities: { api_access: true, automations: false },
            limits: { max_users: 10 },
          },
        }),
        createFakeSubscription({
          id: 'sub-2',
          planSnapshot: {
            capabilities: { api_access: false, automations: true },
            limits: { max_users: 50 },
          },
        }),
      ];
      const service = new SubscriptionQueryService(createMockDb(subs));

      const result = await service.getActiveCapabilities('client-1');

      expect(result.capabilities.api_access).toBe(true);
      expect(result.capabilities.automations).toBe(true);
    });

    it('should merge numeric limits with MAX across subscriptions', async () => {
      const subs = [
        createFakeSubscription({
          id: 'sub-1',
          planSnapshot: { capabilities: {}, limits: { max_users: 10, storage_gb: 100 } },
        }),
        createFakeSubscription({
          id: 'sub-2',
          planSnapshot: { capabilities: {}, limits: { max_users: 50, storage_gb: 50 } },
        }),
      ];
      const service = new SubscriptionQueryService(createMockDb(subs));

      const result = await service.getActiveCapabilities('client-1');

      expect(result.limits.max_users).toBe(50);
      expect(result.limits.storage_gb).toBe(100);
    });

    it('should return empty capabilities when no active subscriptions', async () => {
      const service = new SubscriptionQueryService(createMockDb([]));

      const result = await service.getActiveCapabilities('client-1');

      expect(result.capabilities).toEqual({});
      expect(result.limits).toEqual({});
    });

    it('should handle null capabilities and limits in snapshot', async () => {
      const subs = [
        createFakeSubscription({
          planSnapshot: { capabilities: null, limits: null },
        }),
      ];
      const service = new SubscriptionQueryService(createMockDb(subs));

      const result = await service.getActiveCapabilities('client-1');

      expect(result.capabilities).toEqual({});
      expect(result.limits).toEqual({});
    });
  });

  describe('hasCapability', () => {
    it('should return true when capability exists and is truthy', async () => {
      const subs = [createFakeSubscription()];
      const service = new SubscriptionQueryService(createMockDb(subs));

      expect(await service.hasCapability('client-1', 'api_access')).toBe(true);
    });

    it('should return false when capability exists but is falsy', async () => {
      const subs = [createFakeSubscription()];
      const service = new SubscriptionQueryService(createMockDb(subs));

      expect(await service.hasCapability('client-1', 'automations')).toBe(false);
    });

    it('should return false when capability does not exist', async () => {
      const subs = [createFakeSubscription()];
      const service = new SubscriptionQueryService(createMockDb(subs));

      expect(await service.hasCapability('client-1', 'nonexistent')).toBe(false);
    });
  });

  describe('getSubscriptionsByClientId', () => {
    it('should return all subscriptions for a client ordered by createdAt', async () => {
      const subs = [
        createFakeSubscription({ id: 'sub-1', status: 'active' }),
        createFakeSubscription({ id: 'sub-2', status: 'cancelled' }),
      ];
      const service = new SubscriptionQueryService(createMockDb(subs));

      const result = await service.getSubscriptionsByClientId('client-1');

      expect(result).toHaveLength(2);
    });
  });
});
