import { describe, it, expect, vi } from 'vitest';
import { OrderLifecycleHookRegistry } from '../order-lifecycle-hook-registry';
import type { OrderLifecycleHooks, CreateOrderInput, OrderRecord } from '../../types';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
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

function createFakeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
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

describe('OrderLifecycleHookRegistry', () => {
  it('should run beforeCreate hooks in order and pass through input', async () => {
    const registry = new OrderLifecycleHookRegistry(createMockAppLogger());
    const input = createFakeInput();

    const hooks: OrderLifecycleHooks = {
      beforeCreate: vi.fn().mockImplementation(async (i) => ({
        ...i,
        notes: 'enriched',
      })),
    };

    registry.register(hooks);
    const result = await registry.runBeforeCreate(input);

    expect(result.notes).toBe('enriched');
    expect(hooks.beforeCreate).toHaveBeenCalledWith(input);
  });

  it('should chain multiple beforeCreate hooks', async () => {
    const registry = new OrderLifecycleHookRegistry(createMockAppLogger());
    const input = createFakeInput();

    registry.register({
      beforeCreate: async (i) => ({ ...i, notes: 'first' }),
    });
    registry.register({
      beforeCreate: async (i) => ({ ...i, metadata: { source: 'second' } }),
    });

    const result = await registry.runBeforeCreate(input);

    expect(result.notes).toBe('first');
    expect(result.metadata).toEqual({ source: 'second' });
  });

  it('should run afterCreate hooks', async () => {
    const registry = new OrderLifecycleHookRegistry(createMockAppLogger());
    const order = createFakeOrder();
    const afterCreate = vi.fn();

    registry.register({ afterCreate });
    await registry.runAfterCreate(order);

    expect(afterCreate).toHaveBeenCalledWith(order);
  });

  it('should handle hooks without all methods', async () => {
    const registry = new OrderLifecycleHookRegistry(createMockAppLogger());
    const input = createFakeInput();
    const order = createFakeOrder();

    registry.register({});

    const result = await registry.runBeforeCreate(input);
    expect(result).toBe(input);

    await expect(registry.runAfterCreate(order)).resolves.toBeUndefined();
  });

  it('should return original input when no hooks registered', async () => {
    const registry = new OrderLifecycleHookRegistry(createMockAppLogger());
    const input = createFakeInput();

    const result = await registry.runBeforeCreate(input);

    expect(result).toBe(input);
  });
});
