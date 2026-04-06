import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionLifecycleService } from '../subscription-lifecycle.service';
import type { AppLoggerService } from '@packages/logger';
import type { SubscriptionPlanRecord, SubscriptionRecord, CreateSubscriptionInput } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: any, data: any) => data),
}));

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

const fakePlan: SubscriptionPlanRecord = {
  id: 'plan-1',
  name: 'Pro Plan',
  slug: 'pro',
  description: 'Professional plan',
  price: 2999,
  currency: 'USD',
  interval: 'monthly',
  intervalCount: 1,
  capabilities: { api_access: true },
  limits: { max_users: 50 },
  isActive: true,
  sortOrder: 1,
  metadata: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  deletedBy: null,
};

function createFakeSubscription(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: 'sub-1',
    clientId: 'client-1',
    clientType: null,
    planId: 'plan-1',
    planSnapshot: {
      id: 'plan-1',
      name: 'Pro Plan',
      slug: 'pro',
      description: 'Professional plan',
      price: 2999,
      currency: 'USD',
      interval: 'monthly',
      intervalCount: 1,
      capabilities: { api_access: true },
      limits: { max_users: 50 },
    },
    orderId: null,
    orderLineItemId: null,
    status: 'pending_activation',
    currentPeriodStart: null,
    currentPeriodEnd: null,
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

const validatedTransition = {
  transitionId: 'trans-1',
  transitionName: 'Activate',
  workflowDefinitionId: 'wf-1',
  workflowName: 'subscription-status',
  fieldName: 'status',
};

describe('SubscriptionLifecycleService', () => {
  let service: SubscriptionLifecycleService;
  let mockDatabase: any;
  let mockWorkflowEngine: any;
  let mockPipelineResolver: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    const fakeSub = createFakeSubscription();

    mockDatabase = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([fakePlan]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([fakeSub]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...fakeSub, status: 'active' }]),
            }),
          }),
        }),
        transaction: vi.fn().mockImplementation(async (fn: any) => {
          const tx = {
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([{ ...fakeSub, status: 'active' }]),
                }),
              }),
            }),
          };
          return fn(tx);
        }),
      },
    };

    mockWorkflowEngine = {
      validateAndThrow: vi.fn().mockResolvedValue(validatedTransition),
      recordHistory: vi.fn().mockResolvedValue({ historyId: 'hist-1', recordedAt: '2026-01-01T00:00:00.000Z' }),
    };

    mockPipelineResolver = {
      resolveForTransition: vi.fn().mockResolvedValue({ slug: 'subscription-status' }),
    };

    mockEventEmitter = {
      emit: vi.fn(),
      emitDynamic: vi.fn(),
    };

    service = new SubscriptionLifecycleService(
      mockDatabase,
      mockWorkflowEngine,
      mockPipelineResolver,
      mockEventEmitter,
      createMockAppLogger(),
    );
  });

  describe('createSubscription', () => {
    it('should create subscription in pending_activation status', async () => {
      const input: CreateSubscriptionInput = {
        clientId: 'client-1',
        planId: 'plan-1',
      };

      const result = await service.createSubscription(input, 'user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('sub-1');
      expect(mockDatabase.db.insert).toHaveBeenCalled();
    });

    it('should store planSnapshot on creation', async () => {
      const input: CreateSubscriptionInput = {
        clientId: 'client-1',
        planId: 'plan-1',
      };

      await service.createSubscription(input, 'user-1');

      const insertCall = mockDatabase.db.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertCall.planSnapshot).toEqual({
        id: 'plan-1',
        name: 'Pro Plan',
        slug: 'pro',
        description: 'Professional plan',
        price: 2999,
        currency: 'USD',
        interval: 'monthly',
        intervalCount: 1,
        capabilities: { api_access: true },
        limits: { max_users: 50 },
      });
    });

    it('should throw if plan not found', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.createSubscription({ clientId: 'client-1', planId: 'nonexistent' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should activate immediately when flag is set', async () => {
      // First call returns plan (for createSubscription), second returns subscription (for findSubscriptionOrFail in activateSubscription)
      const fakeSub = createFakeSubscription();
      let selectCallCount = 0;
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              // First call: find plan, second call: find subscription for activation
              return Promise.resolve(selectCallCount === 1 ? [fakePlan] : [fakeSub]);
            }),
          }),
        }),
      });

      const input: CreateSubscriptionInput = {
        clientId: 'client-1',
        planId: 'plan-1',
        activateImmediately: true,
      };

      const result = await service.createSubscription(input, 'user-1');

      expect(result).toBeDefined();
      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalled();
    });
  });

  describe('activateSubscription', () => {
    it('should transition to active and set period dates', async () => {
      const fakeSub = createFakeSubscription();
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([fakeSub]),
          }),
        }),
      });

      const result = await service.activateSubscription('sub-1', 'user-1');

      expect(result).toBeDefined();
      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: 'pending_activation',
          toState: 'active',
        }),
      );
      expect(mockDatabase.db.transaction).toHaveBeenCalled();
      expect(mockWorkflowEngine.recordHistory).toHaveBeenCalled();
      expect(mockEventEmitter.emitDynamic).toHaveBeenCalledWith(
        'subscriptions.StatusChanged',
        expect.objectContaining({
          entityType: 'subscriptions',
          entityId: 'sub-1',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscriptions.Activated',
        expect.objectContaining({
          entityType: 'subscriptions',
          entityId: 'sub-1',
        }),
      );
    });

    it('should throw if subscription not found', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.activateSubscription('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('renewSubscription', () => {
    it('should extend currentPeriodEnd by plan interval', async () => {
      const activeSub = createFakeSubscription({
        status: 'active',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([activeSub]),
          }),
        }),
      });

      const renewedSub = { ...activeSub, currentPeriodEnd: new Date('2026-03-01') };
      mockDatabase.db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([renewedSub]),
          }),
        }),
      });

      const result = await service.renewSubscription('sub-1', 'user-1');

      expect(result.currentPeriodEnd).toEqual(new Date('2026-03-01'));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscriptions.Renewed',
        expect.objectContaining({
          payload: expect.objectContaining({
            previousPeriodEnd: '2026-02-01T00:00:00.000Z',
          }),
        }),
      );
    });

    it('should throw if subscription is not active', async () => {
      const pendingSub = createFakeSubscription({ status: 'pending_activation' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([pendingSub]),
          }),
        }),
      });

      await expect(
        service.renewSubscription('sub-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for one_time interval', async () => {
      const oneTimeSub = createFakeSubscription({
        status: 'active',
        currentPeriodEnd: new Date('2026-02-01'),
        planSnapshot: {
          ...createFakeSubscription().planSnapshot as object,
          interval: 'one_time',
        },
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([oneTimeSub]),
          }),
        }),
      });

      await expect(
        service.renewSubscription('sub-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelSubscription', () => {
    it('should transition to cancelled and set cancelledAt', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([activeSub]),
          }),
        }),
      });

      const cancelledSub = { ...activeSub, status: 'cancelled', cancelledAt: new Date() };
      mockDatabase.db.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([cancelledSub]),
              }),
            }),
          }),
        };
        return fn(tx);
      });

      const result = await service.cancelSubscription('sub-1', 'user-1');

      expect(result.status).toBe('cancelled');
      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({ toState: 'cancelled' }),
      );
    });
  });

  describe('pauseSubscription', () => {
    it('should transition active to paused', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([activeSub]),
          }),
        }),
      });

      const pausedSub = { ...activeSub, status: 'paused' };
      mockDatabase.db.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([pausedSub]),
              }),
            }),
          }),
        };
        return fn(tx);
      });

      const result = await service.pauseSubscription('sub-1', 'user-1');

      expect(result.status).toBe('paused');
      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({ fromState: 'active', toState: 'paused' }),
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should transition paused to active', async () => {
      const pausedSub = createFakeSubscription({ status: 'paused' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([pausedSub]),
          }),
        }),
      });

      const activeSub = { ...pausedSub, status: 'active' };
      mockDatabase.db.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([activeSub]),
              }),
            }),
          }),
        };
        return fn(tx);
      });

      const result = await service.resumeSubscription('sub-1', 'user-1');

      expect(result.status).toBe('active');
      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({ fromState: 'paused', toState: 'active' }),
      );
    });
  });

  describe('expireSubscription', () => {
    it('should transition active to expired', async () => {
      const activeSub = createFakeSubscription({
        status: 'active',
        currentPeriodEnd: new Date('2026-01-01'),
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([activeSub]),
          }),
        }),
      });

      const expiredSub = { ...activeSub, status: 'expired' };
      mockDatabase.db.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([expiredSub]),
              }),
            }),
          }),
        };
        return fn(tx);
      });

      const result = await service.expireSubscription('sub-1', 'system');

      expect(result.status).toBe('expired');
      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({ fromState: 'active', toState: 'expired', actorId: 'system' }),
      );
      expect(mockEventEmitter.emitDynamic).toHaveBeenCalledWith(
        'subscriptions.StatusChanged',
        expect.objectContaining({
          payload: expect.objectContaining({
            fromState: 'active',
            toState: 'expired',
          }),
        }),
      );
    });
  });
});
