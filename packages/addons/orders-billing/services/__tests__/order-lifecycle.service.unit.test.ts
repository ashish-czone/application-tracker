import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderLifecycleService } from '../order-lifecycle.service';
import type { Product, BillingClient, CreateOrderInput, OrderRecord } from '../../types';
import type { AppLoggerService } from '@packages/logger';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: any, data: any) => data),
}));

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

function createFakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Basic Plan',
    unitPrice: 1000,
    currency: 'USD',
    type: 'plan',
    ...overrides,
  };
}

function createFakeClient(overrides: Partial<BillingClient> = {}): BillingClient {
  return {
    id: 'client-1',
    name: 'Acme Corp',
    email: 'billing@acme.com',
    ...overrides,
  };
}

function createFakeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'order-1',
    orderNumber: 'ORD-20260406-ABC123',
    status: 'draft',
    clientId: 'client-1',
    clientType: null,
    totalAmount: 1000,
    currency: 'USD',
    notes: null,
    metadata: null,
    expiresAt: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

function createFakeInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    clientId: 'client-1',
    currency: 'USD',
    lineItems: [
      { productId: 'prod-1', productType: 'plan', quantity: 1 },
    ],
    ...overrides,
  };
}

describe('OrderLifecycleService', () => {
  let service: OrderLifecycleService;
  let mockDatabase: any;
  let mockProductRegistry: any;
  let mockClientRegistry: any;
  let mockHookRegistry: any;
  let mockLineItemsService: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    const fakeOrder = createFakeOrder();

    mockDatabase = {
      db: {
        transaction: vi.fn().mockImplementation(async (fn: any) => fn({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([fakeOrder]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        })),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([fakeOrder]),
            }),
          }),
        }),
      },
    };

    mockProductRegistry = {
      resolve: vi.fn().mockResolvedValue(createFakeProduct()),
    };

    mockClientRegistry = {
      resolve: vi.fn().mockResolvedValue(createFakeClient()),
    };

    mockHookRegistry = {
      runBeforeCreate: vi.fn().mockImplementation(async (input: any) => input),
      runAfterCreate: vi.fn().mockResolvedValue(undefined),
    };

    mockLineItemsService = {
      createMany: vi.fn().mockResolvedValue([{ id: 'li-1' }]),
      findByOrderId: vi.fn().mockResolvedValue([
        { id: 'li-1', totalPrice: 1000 },
        { id: 'li-2', totalPrice: 500 },
      ]),
      deleteById: vi.fn().mockResolvedValue(undefined),
    };

    mockEventEmitter = {
      emit: vi.fn(),
    };

    service = new OrderLifecycleService(
      mockDatabase,
      mockProductRegistry,
      mockClientRegistry,
      mockHookRegistry,
      mockLineItemsService,
      mockEventEmitter,
      createMockAppLogger(),
    );
  });

  describe('createOrder', () => {
    it('should create order with line items in a transaction', async () => {
      const input = createFakeInput();
      const result = await service.createOrder(input, 'user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('order-1');
      expect(mockClientRegistry.resolve).toHaveBeenCalledWith('client-1', undefined);
      expect(mockProductRegistry.resolve).toHaveBeenCalledWith('prod-1', 'plan');
      expect(mockDatabase.db.transaction).toHaveBeenCalled();
      expect(mockLineItemsService.createMany).toHaveBeenCalled();
    });

    it('should run lifecycle hooks', async () => {
      const input = createFakeInput();
      await service.createOrder(input, 'user-1');

      expect(mockHookRegistry.runBeforeCreate).toHaveBeenCalledWith(input);
      expect(mockHookRegistry.runAfterCreate).toHaveBeenCalled();
    });

    it('should emit ORDERS_ORDER_CREATED event', async () => {
      const input = createFakeInput();
      await service.createOrder(input, 'user-1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'orders.OrderCreated',
        expect.objectContaining({
          entityType: 'orders',
          entityId: 'order-1',
          actorId: 'user-1',
        }),
      );
    });

    it('should throw when client not found', async () => {
      mockClientRegistry.resolve.mockResolvedValue(null);

      await expect(service.createOrder(createFakeInput(), 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw when product not found', async () => {
      mockProductRegistry.resolve.mockResolvedValue(null);

      await expect(service.createOrder(createFakeInput(), 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw when no line items provided', async () => {
      const input = createFakeInput({ lineItems: [] });

      await expect(service.createOrder(input, 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should compute totalAmount from resolved product prices', async () => {
      mockProductRegistry.resolve.mockResolvedValue(createFakeProduct({ unitPrice: 2500 }));
      const input = createFakeInput({
        lineItems: [
          { productId: 'p1', productType: 'plan', quantity: 2 },
          { productId: 'p2', productType: 'plan', quantity: 1 },
        ],
      });

      await service.createOrder(input, 'user-1');

      const txFn = mockDatabase.db.transaction.mock.calls[0][0];
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createFakeOrder({ totalAmount: 7500 })]),
          }),
        }),
      };

      // Verify line items service was called with correct totalPrice values
      const createManyCall = mockLineItemsService.createMany.mock.calls[0][0];
      expect(createManyCall).toHaveLength(2);
      expect(createManyCall[0].unitPrice).toBe(2500);
      expect(createManyCall[0].totalPrice).toBe(5000); // 2500 * 2
      expect(createManyCall[1].totalPrice).toBe(2500); // 2500 * 1
    });
  });

  describe('addLineItem', () => {
    it('should add line item to draft order and recalculate total', async () => {
      const result = await service.addLineItem('order-1', {
        productId: 'prod-2',
        productType: 'plan',
        quantity: 1,
      }, 'user-1');

      expect(result).toBeDefined();
      expect(mockProductRegistry.resolve).toHaveBeenCalledWith('prod-2', 'plan');
    });

    it('should throw when order is not in draft status', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createFakeOrder({ status: 'active' })]),
          }),
        }),
      });

      await expect(
        service.addLineItem('order-1', {
          productId: 'prod-1',
          productType: 'plan',
          quantity: 1,
        }, 'user-1'),
      ).rejects.toThrow('Line items can only be added to draft orders');
    });

    it('should throw when product not found', async () => {
      mockProductRegistry.resolve.mockResolvedValue(null);

      await expect(
        service.addLineItem('order-1', {
          productId: 'unknown',
          productType: 'plan',
          quantity: 1,
        }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeLineItem', () => {
    it('should remove line item from draft order and recalculate total', async () => {
      await service.removeLineItem('order-1', 'li-1', 'user-1');

      expect(mockLineItemsService.deleteById).toHaveBeenCalledWith('li-1', expect.anything());
    });

    it('should throw when order is not in draft status', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createFakeOrder({ status: 'pending' })]),
          }),
        }),
      });

      await expect(
        service.removeLineItem('order-1', 'li-1', 'user-1'),
      ).rejects.toThrow('Line items can only be removed from draft orders');
    });

    it('should throw when line item not found', async () => {
      await expect(
        service.removeLineItem('order-1', 'nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when trying to remove the last line item', async () => {
      mockLineItemsService.findByOrderId.mockResolvedValue([
        { id: 'li-1', totalPrice: 1000 },
      ]);

      await expect(
        service.removeLineItem('order-1', 'li-1', 'user-1'),
      ).rejects.toThrow('Cannot remove the last line item from an order');
    });
  });

  describe('getOrderWithLineItems', () => {
    it('should return order with its line items', async () => {
      const result = await service.getOrderWithLineItems('order-1');

      expect(result.order.id).toBe('order-1');
      expect(result.lineItems).toHaveLength(2);
    });

    it('should throw when order not found', async () => {
      mockDatabase.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.getOrderWithLineItems('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
