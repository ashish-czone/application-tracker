import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { runWithCorrelationId, getTenantId } from '@packages/logger';
import { TenantJwtGuard } from '../tenant-jwt.guard';
import type { TenancyConfig } from '../../types';

function createGuard(config: Partial<TenancyConfig> = {}) {
  const fullConfig: TenancyConfig = {
    mode: 'rls',
    resolver: 'jwt',
    ...config,
  };
  const reflector = new Reflector();
  // Stub reflector to return false for IS_PUBLIC_KEY
  reflector.getAllAndOverride = () => false;
  return new TenantJwtGuard(fullConfig, reflector);
}

function createContext(user?: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('TenantJwtGuard', () => {
  it('should set tenant from JWT tenantId claim', () => {
    const guard = createGuard({ resolver: 'jwt' });
    const context = createContext({ userId: 'u1', tenantId: 'tenant-abc' });

    runWithCorrelationId('test', () => {
      const result = guard.canActivate(context);
      expect(result).toBe(true);
      expect(getTenantId()).toBe('tenant-abc');
    });
  });

  it('should use custom JWT claim name', () => {
    const guard = createGuard({ resolver: 'jwt', jwtClaim: 'organizationId' });
    const context = createContext({ userId: 'u1', organizationId: 'org-123' });

    runWithCorrelationId('test', () => {
      const result = guard.canActivate(context);
      expect(result).toBe(true);
      expect(getTenantId()).toBe('org-123');
    });
  });

  it('should throw ForbiddenException when tenant claim is missing', () => {
    const guard = createGuard({ resolver: 'jwt' });
    const context = createContext({ userId: 'u1' });

    runWithCorrelationId('test', () => {
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  it('should skip when resolver is not jwt', () => {
    const guard = createGuard({ resolver: 'header' });
    const context = createContext({ userId: 'u1' });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should skip when no user on request (pre-auth)', () => {
    const guard = createGuard({ resolver: 'jwt' });
    const context = createContext(undefined);

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });
});
