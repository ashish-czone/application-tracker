import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { runWithCorrelationId, getTenantId, setTenantId } from '@packages/logger';
import { TenantJwtGuard } from '../tenant-jwt.guard';
import type { TenancyConfig, TenantInfo, TenantLookup } from '../../types';

const activeTenant: TenantInfo = {
  id: 'tenant-uuid-1',
  slug: 'acme',
  name: 'ACME Corp',
  databaseUrl: 'postgresql://acme@localhost/acme',
  status: 'active',
};

const suspendedTenant: TenantInfo = {
  ...activeTenant,
  id: 'tenant-uuid-2',
  slug: 'suspended-co',
  status: 'suspended',
};

function createMockLookup(tenants: TenantInfo[] = [activeTenant, suspendedTenant]): TenantLookup {
  return {
    findBySlug: vi.fn(async (slug: string) => tenants.find(t => t.slug === slug) ?? null),
    findById: vi.fn(async (id: string) => tenants.find(t => t.id === id) ?? null),
  };
}

function createMockDatabase() {
  return {
    acquireForRequest: vi.fn().mockResolvedValue(undefined),
    releaseForRequest: vi.fn().mockResolvedValue(undefined),
  };
}

function createGuard(
  lookup?: TenantLookup,
  database?: any,
  config?: Partial<TenancyConfig>,
) {
  const fullConfig: TenancyConfig = { mode: 'database', resolver: 'header', ...config };
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => false;
  return new TenantJwtGuard(
    fullConfig,
    lookup ?? createMockLookup(),
    database ?? createMockDatabase(),
    reflector,
  );
}

function createContext(user?: Record<string, unknown>) {
  const onFinish = vi.fn();
  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({ on: onFinish }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any,
    onFinish,
  };
}

describe('TenantJwtGuard', () => {
  it('should skip when tenant already resolved by middleware', async () => {
    const lookup = createMockLookup();
    const guard = createGuard(lookup);
    const { context } = createContext({ userId: 'u1', tenantSlug: 'acme' });

    await runWithCorrelationId('test', async () => {
      setTenantId('already-set');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(lookup.findBySlug).not.toHaveBeenCalled();
    });
  });

  it('should resolve tenant from JWT tenantSlug and acquire connection', async () => {
    const lookup = createMockLookup();
    const database = createMockDatabase();
    const guard = createGuard(lookup, database);
    const { context } = createContext({ userId: 'u1', tenantSlug: 'acme' });

    await runWithCorrelationId('test', async () => {
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(getTenantId()).toBe('tenant-uuid-1');
      expect(lookup.findBySlug).toHaveBeenCalledWith('acme');
      expect(database.acquireForRequest).toHaveBeenCalledWith('tenant-uuid-1', 'test');
    });
  });

  it('should throw when tenantSlug is missing from JWT', async () => {
    const guard = createGuard();
    const { context } = createContext({ userId: 'u1' });

    await runWithCorrelationId('test', async () => {
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  it('should throw when tenant is not found', async () => {
    const guard = createGuard();
    const { context } = createContext({ userId: 'u1', tenantSlug: 'nonexistent' });

    await runWithCorrelationId('test', async () => {
      await expect(guard.canActivate(context)).rejects.toThrow('Tenant not found');
    });
  });

  it('should throw when tenant is suspended', async () => {
    const guard = createGuard();
    const { context } = createContext({ userId: 'u1', tenantSlug: 'suspended-co' });

    await runWithCorrelationId('test', async () => {
      await expect(guard.canActivate(context)).rejects.toThrow('Tenant is suspended');
    });
  });

  it('should skip when no user on request (pre-auth)', async () => {
    const guard = createGuard();
    const { context } = createContext(undefined);

    await runWithCorrelationId('test', async () => {
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  it('should register cleanup on response finish', async () => {
    const database = createMockDatabase();
    const guard = createGuard(undefined, database);
    const { context, onFinish } = createContext({ userId: 'u1', tenantSlug: 'acme' });

    await runWithCorrelationId('test', async () => {
      await guard.canActivate(context);
      expect(onFinish).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });
});
