import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth.guard';
import type { AuthService } from '../../services/auth.service';

function createMockContext(authHeader?: string, isPublic = false) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

  const request = { headers: { authorization: authHeader }, user: undefined };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;

  return { reflector, context, request };
}

function createMockAuthService(payload?: any): AuthService {
  return {
    verifyAccessToken: payload
      ? vi.fn().mockReturnValue(payload)
      : vi.fn().mockImplementation(() => { throw new Error('invalid token'); }),
  } as any;
}

describe('AuthGuard', () => {
  it('should allow public routes without auth', () => {
    const { reflector, context } = createMockContext(undefined, true);
    const authService = createMockAuthService();
    const guard = new AuthGuard(reflector, authService);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when no auth header', () => {
    const { reflector, context } = createMockContext(undefined, false);
    const authService = createMockAuthService();
    const guard = new AuthGuard(reflector, authService);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when auth header is not Bearer', () => {
    const { reflector, context } = createMockContext('Basic abc123', false);
    const authService = createMockAuthService();
    const guard = new AuthGuard(reflector, authService);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should attach user to request on valid token', () => {
    const payload = { userId: 'u1', userType: 'admin' };
    const { reflector, context, request } = createMockContext('Bearer valid-token', false);
    const authService = createMockAuthService(payload);
    const guard = new AuthGuard(reflector, authService);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual(payload);
    expect(authService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('should throw UnauthorizedException on invalid token', () => {
    const { reflector, context } = createMockContext('Bearer invalid-token', false);
    const authService = createMockAuthService(); // throws
    const guard = new AuthGuard(reflector, authService);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
