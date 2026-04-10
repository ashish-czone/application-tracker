import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CapabilityGuard } from '../capability.guard';
import { CAPABILITY_KEY } from '../../decorators/require-capability.decorator';

function createMockContext(user?: Record<string, unknown>): ExecutionContext {
  const request = { user };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createGuard(metadata: Record<string, unknown> = {}): CapabilityGuard {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
    return metadata[key];
  });
  return new CapabilityGuard(reflector);
}

describe('CapabilityGuard', () => {
  it('should allow requests with no @RequireCapability decorator', () => {
    const guard = createGuard({});
    const ctx = createMockContext({ userId: 'u1' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow public routes even with @RequireCapability', () => {
    const guard = createGuard({
      [CAPABILITY_KEY]: 'automations',
      isPublic: true,
    });
    const ctx = createMockContext();

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject when user is missing', () => {
    const guard = createGuard({ [CAPABILITY_KEY]: 'automations' });
    const ctx = createMockContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should reject when capabilities are missing from JWT', () => {
    const guard = createGuard({ [CAPABILITY_KEY]: 'automations' });
    const ctx = createMockContext({ userId: 'u1' });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('Subscription capabilities not available');
  });

  it('should reject when capabilities is not an array', () => {
    const guard = createGuard({ [CAPABILITY_KEY]: 'automations' });
    const ctx = createMockContext({ userId: 'u1', capabilities: 'automations' });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should reject when required capability is not in the list', () => {
    const guard = createGuard({ [CAPABILITY_KEY]: 'automations' });
    const ctx = createMockContext({
      userId: 'u1',
      capabilities: ['custom_fields', 'audit_log'],
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('"automations" capability');
  });

  it('should allow when required capability is present', () => {
    const guard = createGuard({ [CAPABILITY_KEY]: 'automations' });
    const ctx = createMockContext({
      userId: 'u1',
      capabilities: ['custom_fields', 'automations', 'audit_log'],
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject empty capabilities array', () => {
    const guard = createGuard({ [CAPABILITY_KEY]: 'automations' });
    const ctx = createMockContext({
      userId: 'u1',
      capabilities: [],
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
