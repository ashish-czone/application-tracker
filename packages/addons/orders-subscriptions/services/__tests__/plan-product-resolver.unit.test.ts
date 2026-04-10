import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanProductResolver } from '../plan-product-resolver';
import type { DatabaseService } from '@packages/database';

function createMockDb(rows: any[] = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return { db: chain } as unknown as DatabaseService;
}

const fakePlan = {
  id: 'plan-1',
  name: 'Pro Plan',
  slug: 'pro',
  description: 'Professional plan',
  price: 2999,
  currency: 'USD',
  interval: 'monthly',
  intervalCount: 1,
  capabilities: { api_access: true, automations: true },
  limits: { max_users: 50 },
  isActive: true,
  sortOrder: 1,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  deletedBy: null,
};

describe('PlanProductResolver', () => {
  let resolver: PlanProductResolver;
  let mockDb: DatabaseService;

  describe('resolve', () => {
    it('should resolve a plan to a Product interface', async () => {
      mockDb = createMockDb([fakePlan]);
      resolver = new PlanProductResolver(mockDb);

      const result = await resolver.resolve('plan-1');

      expect(result).toEqual({
        id: 'plan-1',
        name: 'Pro Plan',
        description: 'Professional plan',
        unitPrice: 2999,
        currency: 'USD',
        type: 'subscription-plan',
        metadata: {
          slug: 'pro',
          interval: 'monthly',
          intervalCount: 1,
          capabilities: { api_access: true, automations: true },
          limits: { max_users: 50 },
        },
      });
    });

    it('should return null when plan not found', async () => {
      mockDb = createMockDb([]);
      resolver = new PlanProductResolver(mockDb);

      const result = await resolver.resolve('nonexistent');

      expect(result).toBeNull();
    });

    it('should omit description when null', async () => {
      mockDb = createMockDb([{ ...fakePlan, description: null }]);
      resolver = new PlanProductResolver(mockDb);

      const result = await resolver.resolve('plan-1');

      expect(result?.description).toBeUndefined();
    });

    it('should handle plan with null capabilities and limits', async () => {
      mockDb = createMockDb([{ ...fakePlan, capabilities: null, limits: null }]);
      resolver = new PlanProductResolver(mockDb);

      const result = await resolver.resolve('plan-1');

      expect(result?.metadata).toEqual({
        slug: 'pro',
        interval: 'monthly',
        intervalCount: 1,
        capabilities: null,
        limits: null,
      });
    });

    it('should set type to subscription-plan', async () => {
      mockDb = createMockDb([fakePlan]);
      resolver = new PlanProductResolver(mockDb);

      const result = await resolver.resolve('plan-1');

      expect(result?.type).toBe('subscription-plan');
    });
  });
});
