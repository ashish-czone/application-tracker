import { describe, it, expect, vi } from 'vitest';
import { ProductResolverRegistry } from '../product-resolver-registry';
import type { ProductResolver, Product } from '../../types';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

function createFakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Test Product',
    unitPrice: 1000,
    currency: 'USD',
    type: 'plan',
    ...overrides,
  };
}

describe('ProductResolverRegistry', () => {
  it('should register and resolve a product', async () => {
    const registry = new ProductResolverRegistry(createMockAppLogger());
    const product = createFakeProduct();
    const resolver: ProductResolver = { resolve: vi.fn().mockResolvedValue(product) };

    registry.register('plan', resolver);
    const result = await registry.resolve('prod-1', 'plan');

    expect(result).toBe(product);
    expect(resolver.resolve).toHaveBeenCalledWith('prod-1');
  });

  it('should return null for unregistered type', async () => {
    const registry = new ProductResolverRegistry(createMockAppLogger());

    const result = await registry.resolve('prod-1', 'unknown');

    expect(result).toBeNull();
  });

  it('should report has() correctly', () => {
    const registry = new ProductResolverRegistry(createMockAppLogger());
    const resolver: ProductResolver = { resolve: vi.fn() };

    registry.register('ticket', resolver);

    expect(registry.has('ticket')).toBe(true);
    expect(registry.has('plan')).toBe(false);
  });

  it('should support multiple product types', async () => {
    const registry = new ProductResolverRegistry(createMockAppLogger());
    const planProduct = createFakeProduct({ id: 'plan-1', type: 'plan' });
    const ticketProduct = createFakeProduct({ id: 'ticket-1', type: 'ticket' });

    registry.register('plan', { resolve: vi.fn().mockResolvedValue(planProduct) });
    registry.register('ticket', { resolve: vi.fn().mockResolvedValue(ticketProduct) });

    expect(await registry.resolve('plan-1', 'plan')).toBe(planProduct);
    expect(await registry.resolve('ticket-1', 'ticket')).toBe(ticketProduct);
  });

  it('should overwrite resolver when registering same type twice', async () => {
    const registry = new ProductResolverRegistry(createMockAppLogger());
    const first: ProductResolver = { resolve: vi.fn().mockResolvedValue(createFakeProduct({ name: 'First' })) };
    const second: ProductResolver = { resolve: vi.fn().mockResolvedValue(createFakeProduct({ name: 'Second' })) };

    registry.register('plan', first);
    registry.register('plan', second);

    const result = await registry.resolve('prod-1', 'plan');
    expect(result?.name).toBe('Second');
    expect(first.resolve).not.toHaveBeenCalled();
  });
});
