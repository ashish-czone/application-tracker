import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from '../rbac.guard';

function createMockContext(user: any, permission?: string) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permission);

  const request = { user };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;

  return { guard: new RbacGuard(reflector), context };
}

describe('RbacGuard', () => {
  it('should allow access when no permission is required', () => {
    const { guard, context } = createMockContext({ userId: 'u1' }, undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has the required permission', () => {
    const user = { userId: 'u1', permissions: { 'candidates.create': 'all', 'candidates.read': 'own' } };
    const { guard, context } = createMockContext(user, 'candidates.create');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks the required permission', () => {
    const user = { userId: 'u1', permissions: { 'candidates.read': 'all' } };
    const { guard, context } = createMockContext(user, 'candidates.create');

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user has no permissions array', () => {
    const user = { userId: 'u1' };
    const { guard, context } = createMockContext(user, 'candidates.create');

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when no user on request', () => {
    const { guard, context } = createMockContext(null, 'candidates.create');

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
