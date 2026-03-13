import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthGuard } from '../auth.guard';
import { AUTH_CONFIGS_MAP } from '../../constants';
import { generateAccessToken, generateRefreshToken } from '@packages/auth';
import type { AuthModuleConfig, AuthenticableUser } from '@packages/auth';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

const SECRET = 'test-secret';
const ENTITY_NAME = 'user';

const mockUser: AuthenticableUser = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: 'hashed',
  refreshToken: null,
  timezone: null,
};

function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
  const request: Record<string, unknown> = { headers, user: undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({} as ReturnType<ExecutionContext['switchToRpc']>),
    switchToWs: () => ({} as ReturnType<ExecutionContext['switchToWs']>),
  } as unknown as ExecutionContext;
}

function createMockConfig(overrides: Partial<AuthModuleConfig> = {}): AuthModuleConfig {
  return {
    entityName: ENTITY_NAME,
    routePrefix: 'auth',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
    jwtSecret: SECRET,
    getUserDelegate: () => ({
      findUnique: async () => mockUser,
      update: async () => mockUser,
      create: async () => mockUser,
    }),
    getPasswordTokenDelegate: () => ({
      findUnique: async () => null,
      create: async () => ({} as never),
      update: async () => ({} as never),
    }),
    ...overrides,
  };
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AuthGuard(reflector);
    AUTH_CONFIGS_MAP.set(ENTITY_NAME, createMockConfig());
  });

  afterEach(() => {
    AUTH_CONFIGS_MAP.clear();
  });

  it('should pass @Public() routes', async () => {
    reflector.getAllAndOverride = () => true;
    const context = createMockContext();
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should return 401 for missing Authorization header', async () => {
    reflector.getAllAndOverride = () => false;
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should return 401 for malformed Bearer token', async () => {
    reflector.getAllAndOverride = () => false;
    const context = createMockContext({ authorization: 'NotBearer token' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should return 401 for expired token', async () => {
    reflector.getAllAndOverride = () => false;
    const token = generateAccessToken(
      { sub: 'user-123', email: 'test@example.com', entityName: ENTITY_NAME },
      SECRET,
      '0s',
    );
    const context = createMockContext({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should return 401 for unregistered entityName', async () => {
    reflector.getAllAndOverride = () => false;
    const token = generateAccessToken(
      { sub: 'user-123', email: 'test@example.com', entityName: 'unknown' },
      SECRET,
      '15m',
    );
    const context = createMockContext({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should attach user to request for valid token', async () => {
    reflector.getAllAndOverride = () => false;
    const token = generateAccessToken(
      { sub: mockUser.id, email: mockUser.email, entityName: ENTITY_NAME },
      SECRET,
      '15m',
    );
    const context = createMockContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(context);

    const request = context.switchToHttp().getRequest();
    expect(request.user).toEqual(mockUser);
  });
});
