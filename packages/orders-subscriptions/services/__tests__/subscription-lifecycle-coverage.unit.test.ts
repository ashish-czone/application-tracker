import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionLifecycleService } from '../subscription-lifecycle.service';
import type { AppLoggerService } from '@packages/logger';
import type { SubscriptionRecord, SubscriptionPlanRecord } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DB mock factory
// ---------------------------------------------------------------------------

function createMockDb(selectResult: any[] = []) {
  const txUpdate = vi.fn();
  const txSet = vi.fn();
  const txWhere = vi.fn();
  const txReturning = vi.fn().mockResolvedValue([]);

  txUpdate.mockReturnValue({ set: txSet });
  txSet.mockReturnValue({ where: txWhere });
  txWhere.mockReturnValue({ returning: txReturning });

  const tx = { update: txUpdate, set: txSet, where: txWhere, returning: txReturning };

  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(selectResult),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    transaction: vi.fn().mockImplementation(async (fn: any) => fn(tx)),
  };

  return { db, _tx: tx, _txReturning: txReturning };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubscriptionLifecycleService — coverage extension', () => {
  let service: SubscriptionLifecycleService;
  let mockDatabase: any;
  let mockWorkflowEngine: any;
  let mockPipelineResolver: any;
  let mockEventEmitter: any;
  let txReturning: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const pendingSub = createFakeSubscription();
    const { db, _txReturning } = createMockDb([pendingSub]);
    txReturning = _txReturning;

    mockDatabase = { db };

    mockWorkflowEngine = {
      validateAndThrow: vi.fn().mockResolvedValue(validatedTransition),
      recordHistory: vi.fn().mockResolvedValue(undefined),
    };

    mockPipelineResolver = {
      resolveForTransition: vi.fn().mockResolvedValue({ slug: 'subscription-status' }),
    };

    mockEventEmitter = { emit: vi.fn(), emitDynamic: vi.fn() };

    service = new SubscriptionLifecycleService(
      mockDatabase,
      mockWorkflowEngine,
      mockPipelineResolver,
      mockEventEmitter,
      createMockAppLogger(),
    );
  });

  // -----------------------------------------------------------------------
  // activateSubscription — deep assertions
  // -----------------------------------------------------------------------

  describe('activateSubscription', () => {
    it('should call validateAndThrow with correct workflow slug and states', async () => {
      const sub = createFakeSubscription({ status: 'pending_activation' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      const activatedSub = { ...sub, status: 'active' };
      txReturning.mockResolvedValue([activatedSub]);

      await service.activateSubscription('sub-1', 'actor-1');

      expect(mockPipelineResolver.resolveForTransition).toHaveBeenCalledWith(
        'subscriptions', 'sub-1', 'status',
      );
      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith({
        workflowSlug: 'subscription-status',
        entityType: 'subscriptions',
        entityId: 'sub-1',
        fromState: 'pending_activation',
        toState: 'active',
        actorId: 'actor-1',
      });
    });

    it('should record workflow history inside the transaction', async () => {
      const sub = createFakeSubscription();
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      const activatedSub = { ...sub, status: 'active' };
      txReturning.mockResolvedValue([activatedSub]);

      await service.activateSubscription('sub-1', 'actor-1');

      expect(mockWorkflowEngine.recordHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowDefinitionId: 'wf-1',
          entityType: 'subscriptions',
          entityId: 'sub-1',
          fieldName: 'status',
          fromState: 'pending_activation',
          toState: 'active',
          transitionId: 'trans-1',
          actorId: 'actor-1',
        }),
        expect.anything(), // tx object
      );
    });

    it('should emit SUBSCRIPTIONS_ACTIVATED with period dates and plan/client info', async () => {
      const sub = createFakeSubscription();
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      const activatedSub = { ...sub, status: 'active', planId: 'plan-1', clientId: 'client-1' };
      txReturning.mockResolvedValue([activatedSub]);

      await service.activateSubscription('sub-1', 'actor-1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscriptions.Activated',
        expect.objectContaining({
          entityType: 'subscriptions',
          entityId: 'sub-1',
          actorId: 'actor-1',
          payload: expect.objectContaining({
            planId: 'plan-1',
            clientId: 'client-1',
            currentPeriodStart: expect.any(String),
            currentPeriodEnd: expect.any(String),
          }),
        }),
      );
    });

    it('should emit subscriptions.StatusChanged via emitDynamic', async () => {
      const sub = createFakeSubscription();
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      txReturning.mockResolvedValue([{ ...sub, status: 'active' }]);

      await service.activateSubscription('sub-1', 'actor-1');

      expect(mockEventEmitter.emitDynamic).toHaveBeenCalledWith(
        'subscriptions.StatusChanged',
        expect.objectContaining({
          entityType: 'subscriptions',
          entityId: 'sub-1',
          actorId: 'actor-1',
          payload: expect.objectContaining({
            workflowSlug: 'subscription-status',
            fieldName: 'status',
            fromState: 'pending_activation',
            toState: 'active',
            transitionId: 'trans-1',
            transitionName: 'Activate',
          }),
        }),
      );
    });

    it('should throw NotFoundException when subscription does not exist', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      await expect(service.activateSubscription('nonexistent', 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should propagate workflow validation errors', async () => {
      const sub = createFakeSubscription();
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      mockWorkflowEngine.validateAndThrow.mockRejectedValue(
        new BadRequestException('Transition not allowed'),
      );

      await expect(service.activateSubscription('sub-1', 'actor-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no workflow is found for transition', async () => {
      const sub = createFakeSubscription();
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      mockPipelineResolver.resolveForTransition.mockResolvedValue(null);

      await expect(service.activateSubscription('sub-1', 'actor-1'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // cancelSubscription — deep assertions
  // -----------------------------------------------------------------------

  describe('cancelSubscription', () => {
    it('should set status to cancelled and populate cancelledAt', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      const cancelledSub = { ...activeSub, status: 'cancelled', cancelledAt: new Date() };
      txReturning.mockResolvedValue([cancelledSub]);

      const result = await service.cancelSubscription('sub-1', 'actor-1');

      expect(result.status).toBe('cancelled');
      expect(result.cancelledAt).toBeInstanceOf(Date);
    });

    it('should record workflow history with cancelled toState', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      txReturning.mockResolvedValue([{ ...activeSub, status: 'cancelled' }]);

      await service.cancelSubscription('sub-1', 'actor-1');

      expect(mockWorkflowEngine.recordHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: 'active',
          toState: 'cancelled',
          actorId: 'actor-1',
        }),
        expect.anything(),
      );
    });

    it('should emit StatusChanged dynamic event for cancellation', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      txReturning.mockResolvedValue([{ ...activeSub, status: 'cancelled' }]);

      await service.cancelSubscription('sub-1', 'actor-1');

      expect(mockEventEmitter.emitDynamic).toHaveBeenCalledWith(
        'subscriptions.StatusChanged',
        expect.objectContaining({
          payload: expect.objectContaining({
            fromState: 'active',
            toState: 'cancelled',
          }),
        }),
      );
    });

    it('should throw NotFoundException when subscription is missing', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      await expect(service.cancelSubscription('missing', 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw when pipeline resolver returns null', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      mockPipelineResolver.resolveForTransition.mockResolvedValue(null);

      await expect(service.cancelSubscription('sub-1', 'actor-1'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // renewSubscription — comprehensive coverage
  // -----------------------------------------------------------------------

  describe('renewSubscription', () => {
    it('should compute new period end using monthly interval', async () => {
      const activeSub = createFakeSubscription({
        status: 'active',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
        planSnapshot: {
          ...createFakeSubscription().planSnapshot as object,
          interval: 'monthly',
          intervalCount: 1,
        },
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      const renewedSub = {
        ...activeSub,
        currentPeriodStart: new Date('2026-02-01'),
        currentPeriodEnd: new Date('2026-03-01'),
      };
      mockDatabase.db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([renewedSub]) }),
        }),
      });

      const result = await service.renewSubscription('sub-1', 'actor-1');

      expect(result.currentPeriodEnd).toEqual(new Date('2026-03-01'));
    });

    it('should compute new period end using yearly interval', async () => {
      const activeSub = createFakeSubscription({
        status: 'active',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2027-01-01'),
        planSnapshot: {
          ...createFakeSubscription().planSnapshot as object,
          interval: 'yearly',
          intervalCount: 1,
        },
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      const renewedSub = {
        ...activeSub,
        currentPeriodStart: new Date('2027-01-01'),
        currentPeriodEnd: new Date('2028-01-01'),
      };
      mockDatabase.db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([renewedSub]) }),
        }),
      });

      const result = await service.renewSubscription('sub-1', 'actor-1');

      expect(result.currentPeriodEnd).toEqual(new Date('2028-01-01'));
    });

    it('should use previousPeriodEnd as the new periodStart', async () => {
      const periodEnd = new Date('2026-03-15');
      const activeSub = createFakeSubscription({
        status: 'active',
        currentPeriodStart: new Date('2026-02-15'),
        currentPeriodEnd: periodEnd,
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...activeSub }]),
        }),
      });
      mockDatabase.db.update.mockReturnValue({ set: setMock });

      await service.renewSubscription('sub-1', 'actor-1');

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPeriodStart: periodEnd,
        }),
      );
    });

    it('should emit SUBSCRIPTIONS_RENEWED with correct payload', async () => {
      const activeSub = createFakeSubscription({
        status: 'active',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      mockDatabase.db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });

      await service.renewSubscription('sub-1', 'actor-1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscriptions.Renewed',
        expect.objectContaining({
          entityType: 'subscriptions',
          entityId: 'sub-1',
          actorId: 'actor-1',
          payload: expect.objectContaining({
            subscriptionId: 'sub-1',
            planId: 'plan-1',
            clientId: 'client-1',
            previousPeriodEnd: '2026-02-01T00:00:00.000Z',
            newPeriodEnd: expect.any(String),
          }),
        }),
      );
    });

    it('should reject if subscription is not active', async () => {
      const expiredSub = createFakeSubscription({ status: 'expired' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([expiredSub]) }),
        }),
      });

      await expect(service.renewSubscription('sub-1', 'actor-1'))
        .rejects.toThrow('Only active subscriptions can be renewed');
    });

    it('should reject if currentPeriodEnd is null', async () => {
      const activeSub = createFakeSubscription({
        status: 'active',
        currentPeriodEnd: null,
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });

      await expect(service.renewSubscription('sub-1', 'actor-1'))
        .rejects.toThrow('Subscription has no current period end date');
    });

    it('should reject one_time interval renewal', async () => {
      const oneTimeSub = createFakeSubscription({
        status: 'active',
        currentPeriodEnd: new Date('2026-06-01'),
        planSnapshot: {
          ...createFakeSubscription().planSnapshot as object,
          interval: 'one_time',
        },
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([oneTimeSub]) }),
        }),
      });

      await expect(service.renewSubscription('sub-1', 'actor-1'))
        .rejects.toThrow('One-time subscriptions cannot be renewed');
    });

    it('should throw NotFoundException when subscription is missing', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      await expect(service.renewSubscription('nonexistent', 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // expireSubscription — deep assertions
  // -----------------------------------------------------------------------

  describe('expireSubscription', () => {
    it('should set status to expired via workflow transition', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      const expiredSub = { ...activeSub, status: 'expired' };
      txReturning.mockResolvedValue([expiredSub]);

      const result = await service.expireSubscription('sub-1', 'system');

      expect(result.status).toBe('expired');
    });

    it('should validate transition with correct toState', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      txReturning.mockResolvedValue([{ ...activeSub, status: 'expired' }]);

      await service.expireSubscription('sub-1', 'system');

      expect(mockWorkflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: 'active',
          toState: 'expired',
          actorId: 'system',
        }),
      );
    });

    it('should record workflow history for expiry', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      txReturning.mockResolvedValue([{ ...activeSub, status: 'expired' }]);

      await service.expireSubscription('sub-1', 'system');

      expect(mockWorkflowEngine.recordHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: 'active',
          toState: 'expired',
          transitionId: 'trans-1',
        }),
        expect.anything(),
      );
    });

    it('should emit StatusChanged dynamic event with expired toState', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      txReturning.mockResolvedValue([{ ...activeSub, status: 'expired' }]);

      await service.expireSubscription('sub-1', 'system');

      expect(mockEventEmitter.emitDynamic).toHaveBeenCalledWith(
        'subscriptions.StatusChanged',
        expect.objectContaining({
          payload: expect.objectContaining({
            fromState: 'active',
            toState: 'expired',
            transitionId: 'trans-1',
            transitionName: 'Activate',
          }),
        }),
      );
    });

    it('should throw NotFoundException for missing subscription', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      await expect(service.expireSubscription('missing', 'system'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw when workflow validation rejects the transition', async () => {
      const activeSub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([activeSub]) }),
        }),
      });
      mockWorkflowEngine.validateAndThrow.mockRejectedValue(
        new BadRequestException('Transition not allowed'),
      );

      await expect(service.expireSubscription('sub-1', 'system'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // computeNextPeriodEnd — tested indirectly via activateSubscription
  // -----------------------------------------------------------------------

  describe('computeNextPeriodEnd (indirect)', () => {
    it('should add months for monthly interval', async () => {
      const sub = createFakeSubscription({
        planSnapshot: {
          ...createFakeSubscription().planSnapshot as object,
          interval: 'monthly',
          intervalCount: 3,
        },
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });

      // Capture the set call from the transaction to verify the computed period end
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...sub, status: 'active' }]),
        }),
      });
      const txObj = { update: vi.fn().mockReturnValue({ set: setMock }) };
      mockDatabase.db.transaction.mockImplementation(async (fn: any) => fn(txObj));

      await service.activateSubscription('sub-1', 'actor-1');

      const setArgs = setMock.mock.calls[0][0];
      const start = setArgs.currentPeriodStart as Date;
      const end = setArgs.currentPeriodEnd as Date;
      // 3 months difference
      const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      expect(diffMonths).toBe(3);
    });

    it('should add years for yearly interval', async () => {
      const sub = createFakeSubscription({
        planSnapshot: {
          ...createFakeSubscription().planSnapshot as object,
          interval: 'yearly',
          intervalCount: 2,
        },
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...sub, status: 'active' }]),
        }),
      });
      const txObj = { update: vi.fn().mockReturnValue({ set: setMock }) };
      mockDatabase.db.transaction.mockImplementation(async (fn: any) => fn(txObj));

      await service.activateSubscription('sub-1', 'actor-1');

      const setArgs = setMock.mock.calls[0][0];
      const start = setArgs.currentPeriodStart as Date;
      const end = setArgs.currentPeriodEnd as Date;
      expect(end.getFullYear() - start.getFullYear()).toBe(2);
    });

    it('should return same date for one_time interval', async () => {
      const sub = createFakeSubscription({
        planSnapshot: {
          ...createFakeSubscription().planSnapshot as object,
          interval: 'one_time',
          intervalCount: 1,
        },
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...sub, status: 'active' }]),
        }),
      });
      const txObj = { update: vi.fn().mockReturnValue({ set: setMock }) };
      mockDatabase.db.transaction.mockImplementation(async (fn: any) => fn(txObj));

      await service.activateSubscription('sub-1', 'actor-1');

      const setArgs = setMock.mock.calls[0][0];
      expect(setArgs.currentPeriodStart).toEqual(setArgs.currentPeriodEnd);
    });

    it('should throw BadRequestException for unknown interval', async () => {
      const sub = createFakeSubscription({
        planSnapshot: {
          ...createFakeSubscription().planSnapshot as object,
          interval: 'weekly',
          intervalCount: 1,
        },
      });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });

      await expect(service.activateSubscription('sub-1', 'actor-1'))
        .rejects.toThrow(BadRequestException);
      await expect(service.activateSubscription('sub-1', 'actor-1'))
        .rejects.toThrow('Unknown interval: weekly');
    });
  });

  // -----------------------------------------------------------------------
  // findSubscriptionOrFail / findPlanOrFail — tested indirectly
  // -----------------------------------------------------------------------

  describe('findSubscriptionOrFail (indirect)', () => {
    it('should throw NotFoundException with subscription id in message', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      await expect(service.activateSubscription('sub-404', 'actor-1'))
        .rejects.toThrow('Subscription not found: sub-404');
    });
  });

  describe('findPlanOrFail (indirect)', () => {
    it('should throw NotFoundException with plan id in message', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      await expect(service.createSubscription({ clientId: 'c-1', planId: 'plan-404' }, 'actor-1'))
        .rejects.toThrow('Subscription plan not found: plan-404');
    });
  });

  // -----------------------------------------------------------------------
  // validateTransition — tested indirectly via various lifecycle methods
  // -----------------------------------------------------------------------

  describe('validateTransition (indirect)', () => {
    it('should throw BadRequestException when pipelineResolver returns null', async () => {
      const sub = createFakeSubscription({ status: 'active' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      mockPipelineResolver.resolveForTransition.mockResolvedValue(null);

      await expect(service.expireSubscription('sub-1', 'system'))
        .rejects.toThrow('No workflow found for subscriptions status field');
    });

    it('should forward workflowEngine.validateAndThrow error as-is', async () => {
      const sub = createFakeSubscription({ status: 'paused' });
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([sub]) }),
        }),
      });
      const errorMsg = 'Cannot transition from paused to active';
      mockWorkflowEngine.validateAndThrow.mockRejectedValue(
        new BadRequestException(errorMsg),
      );

      await expect(service.resumeSubscription('sub-1', 'actor-1'))
        .rejects.toThrow(errorMsg);
    });
  });
});
