import { describe, it, expect, vi } from 'vitest';
import { runWithCorrelationId, getTenantId } from '@packages/logger';

vi.mock('@packages/database', () => ({
  DatabaseService: class MockDatabaseService {},
}));

// Import after mock so the module-level import resolves to the mock
const { TenantResolverMiddleware } = await import('../tenant-resolver.middleware');

import type { TenancyConfig } from '../../types';

function createMiddleware(config: Partial<TenancyConfig> = {}) {
  const fullConfig: TenancyConfig = {
    mode: 'rls',
    resolver: 'header',
    ...config,
  };
  const mockDatabase = {} as any;
  return new TenantResolverMiddleware(fullConfig, mockDatabase);
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
    it('should resolve tenant from x-tenant-id header', async () => {
      const middleware = createMiddleware({ resolver: 'header' });
      const req = createReq({ headers: { 'x-tenant-id': 'tenant-abc' } });
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBe('tenant-abc');
      });

      expect(next).toHaveBeenCalled();
    });

    it('should resolve tenant from custom header name', async () => {
      const middleware = createMiddleware({ resolver: 'header', headerName: 'x-org-id' });
      const req = createReq({ headers: { 'x-org-id': 'org-123' } });
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBe('org-123');
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
  });

  describe('subdomain resolver', () => {
    it('should resolve tenant from subdomain', async () => {
      const middleware = createMiddleware({ resolver: 'subdomain' });
      const req = createReq({ hostname: 'acme.app.com' });
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBe('acme');
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

  describe('jwt resolver', () => {
    it('should not resolve in middleware (deferred to guard)', async () => {
      const middleware = createMiddleware({ resolver: 'jwt' });
      const req = createReq();
      const next = vi.fn();

      await runWithCorrelationId('test', async () => {
        await middleware.use(req, createRes(), next);
        expect(getTenantId()).toBeUndefined();
      });

      expect(next).toHaveBeenCalled();
    });
  });
});
