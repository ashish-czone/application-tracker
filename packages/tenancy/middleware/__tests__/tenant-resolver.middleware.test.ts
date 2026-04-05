import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithCorrelationId, getTenantId } from '@packages/logger';
import { TenantResolverMiddleware } from '../tenant-resolver.middleware';
import type { TenancyConfig } from '../../types';

function createMiddleware(config: Partial<TenancyConfig> = {}) {
  const fullConfig: TenancyConfig = {
    mode: 'rls',
    resolver: 'header',
    ...config,
  };
  return new TenantResolverMiddleware(fullConfig);
}

function createReq(overrides: Record<string, any> = {}) {
  return {
    headers: {},
    hostname: 'localhost',
    ...overrides,
  } as any;
}

describe('TenantResolverMiddleware', () => {
  describe('header resolver', () => {
    it('should resolve tenant from x-tenant-id header', () => {
      const middleware = createMiddleware({ resolver: 'header' });
      const req = createReq({ headers: { 'x-tenant-id': 'tenant-abc' } });
      const next = vi.fn();

      runWithCorrelationId('test', () => {
        middleware.use(req, {} as any, next);
        expect(getTenantId()).toBe('tenant-abc');
      });

      expect(next).toHaveBeenCalled();
    });

    it('should resolve tenant from custom header name', () => {
      const middleware = createMiddleware({ resolver: 'header', headerName: 'x-org-id' });
      const req = createReq({ headers: { 'x-org-id': 'org-123' } });
      const next = vi.fn();

      runWithCorrelationId('test', () => {
        middleware.use(req, {} as any, next);
        expect(getTenantId()).toBe('org-123');
      });
    });

    it('should call next without setting tenant when header is missing', () => {
      const middleware = createMiddleware({ resolver: 'header' });
      const req = createReq();
      const next = vi.fn();

      runWithCorrelationId('test', () => {
        middleware.use(req, {} as any, next);
        expect(getTenantId()).toBeUndefined();
      });

      expect(next).toHaveBeenCalled();
    });
  });

  describe('subdomain resolver', () => {
    it('should resolve tenant from subdomain', () => {
      const middleware = createMiddleware({ resolver: 'subdomain' });
      const req = createReq({ hostname: 'acme.app.com' });
      const next = vi.fn();

      runWithCorrelationId('test', () => {
        middleware.use(req, {} as any, next);
        expect(getTenantId()).toBe('acme');
      });
    });

    it('should not resolve when hostname has no subdomain', () => {
      const middleware = createMiddleware({ resolver: 'subdomain' });
      const req = createReq({ hostname: 'app.com' });
      const next = vi.fn();

      runWithCorrelationId('test', () => {
        middleware.use(req, {} as any, next);
        expect(getTenantId()).toBeUndefined();
      });
    });
  });

  describe('jwt resolver', () => {
    it('should not resolve in middleware (deferred to guard)', () => {
      const middleware = createMiddleware({ resolver: 'jwt' });
      const req = createReq();
      const next = vi.fn();

      runWithCorrelationId('test', () => {
        middleware.use(req, {} as any, next);
        expect(getTenantId()).toBeUndefined();
      });

      expect(next).toHaveBeenCalled();
    });
  });
});
