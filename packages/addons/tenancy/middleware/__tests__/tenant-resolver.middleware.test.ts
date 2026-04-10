import { describe, it, expect, vi } from 'vitest';
import { runWithCorrelationId, getTenantId } from '@packages/logger';

vi.mock('@packages/database', () => ({
  DatabaseService: class MockDatabaseService {},
}));

// Import after mock so the module-level import resolves to the mock
const { TenantResolverMiddleware } = await import('../tenant-resolver.middleware');

import type { TenancyConfig, TenantInfo, TenantLookup } from '../../types';

const activeTenant: TenantInfo = {
  id: 'tenant-uuid-1',
  slug: 'acme',
  name: 'ACME Corp',
  databaseUrl: 'postgresql://acme@localhost/acme',
  status: 'active',
};

function createMockLookup(): TenantLookup {
  return {
    findBySlug: vi.fn(async (slug: string) => slug === 'acme' ? activeTenant : null),
    findById: vi.fn(async () => null),
  };
}

function createMiddleware(config: Partial<TenancyConfig> = {}, lookup?: TenantLookup) {
  const fullConfig: TenancyConfig = {
    mode: 'rls',
    resolver: 'header',
    ...config,
  };
  const mockDatabase = {} as any;
  return new TenantResolverMiddleware(fullConfig, lookup ?? createMockLookup(), mockDatabase);
}

function createReq(overrides: Record<string, any> = {}) {
  return {
    headers: {},
    hostname: 'localhost',
    ...overrides,
  } as any;
}

function createRes() {
  return {
    on: vi.fn(),
  } as any;
}

describe('TenantResolverMiddleware', () => {
  describe('header resolver', () => {
    it('should resolve tenant from x-tenant-id header and set UUID', async () => {
      const lookup = createMockLookup();
      const middleware = createMiddleware({ resolver: 'header' }, lookup);
      const req = createReq({ headers: { 'x-tenant-id': 'acme' } });
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBe('tenant-uuid-1');
      });

      expect(lookup.findBySlug).toHaveBeenCalledWith('acme');
      expect(next).toHaveBeenCalled();
    });

    it('should resolve tenant from custom header name', async () => {
      const middleware = createMiddleware({ resolver: 'header', headerName: 'x-org-id' });
      const req = createReq({ headers: { 'x-org-id': 'acme' } });
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBe('tenant-uuid-1');
      });
    });

    it('should call next without setting tenant when header is missing', async () => {
      const middleware = createMiddleware({ resolver: 'header' });
      const req = createReq();
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBeUndefined();
      });

      expect(next).toHaveBeenCalled();
    });

    it('should call next without setting tenant when slug not found', async () => {
      const middleware = createMiddleware({ resolver: 'header' });
      const req = createReq({ headers: { 'x-tenant-id': 'nonexistent' } });
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBeUndefined();
      });

      expect(next).toHaveBeenCalled();
    });
  });

  describe('subdomain resolver', () => {
    it('should resolve tenant from subdomain', async () => {
      const middleware = createMiddleware({ resolver: 'subdomain' });
      const req = createReq({ hostname: 'acme.app.com' });
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBe('tenant-uuid-1');
      });
    });

    it('should not resolve when hostname has no subdomain', async () => {
      const middleware = createMiddleware({ resolver: 'subdomain' });
      const req = createReq({ hostname: 'app.com' });
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBeUndefined();
      });
    });
  });
});
