import { describe, it, expect, vi } from 'vitest';
import { BillingClientResolverRegistry } from '../billing-client-resolver-registry';
import type { BillingClientResolver, BillingClient } from '../../types';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

function createFakeClient(overrides: Partial<BillingClient> = {}): BillingClient {
  return {
    id: 'client-1',
    name: 'Test Client',
    email: 'client@example.com',
    ...overrides,
  };
}

describe('BillingClientResolverRegistry', () => {
  it('should register and resolve with default type', async () => {
    const registry = new BillingClientResolverRegistry(createMockAppLogger());
    const client = createFakeClient();
    const resolver: BillingClientResolver = { resolve: vi.fn().mockResolvedValue(client) };

    registry.register(resolver);
    const result = await registry.resolve('client-1');

    expect(result).toBe(client);
    expect(resolver.resolve).toHaveBeenCalledWith('client-1');
  });

  it('should register and resolve with explicit type', async () => {
    const registry = new BillingClientResolverRegistry(createMockAppLogger());
    const client = createFakeClient();
    const resolver: BillingClientResolver = { resolve: vi.fn().mockResolvedValue(client) };

    registry.register(resolver, 'tenant');
    const result = await registry.resolve('client-1', 'tenant');

    expect(result).toBe(client);
  });

  it('should return null for unregistered type', async () => {
    const registry = new BillingClientResolverRegistry(createMockAppLogger());

    const result = await registry.resolve('client-1', 'unknown');

    expect(result).toBeNull();
  });

  it('should return null when no resolver registered and no type specified', async () => {
    const registry = new BillingClientResolverRegistry(createMockAppLogger());

    const result = await registry.resolve('client-1');

    expect(result).toBeNull();
  });

  it('should report has() correctly', () => {
    const registry = new BillingClientResolverRegistry(createMockAppLogger());
    const resolver: BillingClientResolver = { resolve: vi.fn() };

    registry.register(resolver);

    expect(registry.has()).toBe(true);
    expect(registry.has('default')).toBe(true);
    expect(registry.has('tenant')).toBe(false);
  });

  it('should support multiple client types', async () => {
    const registry = new BillingClientResolverRegistry(createMockAppLogger());
    const tenantClient = createFakeClient({ id: 't-1', name: 'Tenant' });
    const userClient = createFakeClient({ id: 'u-1', name: 'User' });

    registry.register({ resolve: vi.fn().mockResolvedValue(tenantClient) }, 'tenant');
    registry.register({ resolve: vi.fn().mockResolvedValue(userClient) }, 'user');

    expect(await registry.resolve('t-1', 'tenant')).toBe(tenantClient);
    expect(await registry.resolve('u-1', 'user')).toBe(userClient);
  });
});
