import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { UnauthorizedException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ServiceAuthGuard } from '../service-auth.guard';
import type { ServiceAuthConfig } from '../../types';

function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers, serviceAuth: undefined as unknown };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceAuthGuard', () => {
  let callerPrivateKey: string;
  let callerPublicKey: string;
  let receiverPrivateKey: string;
  let guard: ServiceAuthGuard;

  beforeAll(() => {
    const callerPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    callerPrivateKey = callerPair.privateKey;
    callerPublicKey = callerPair.publicKey;

    const receiverPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    receiverPrivateKey = receiverPair.privateKey;

    const config: ServiceAuthConfig = {
      serviceId: 'control-plane',
      privateKey: receiverPrivateKey,
      trustedServices: { 'recruit-app': callerPublicKey },
    };
    guard = new ServiceAuthGuard(config);
  });

  function signToken(payload: Record<string, unknown>, key?: string): string {
    return jwt.sign(payload, key ?? callerPrivateKey, { algorithm: 'RS256' });
  }

  it('should reject requests without Authorization header', () => {
    const ctx = createMockContext();
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should reject requests without Bearer prefix', () => {
    const ctx = createMockContext({ authorization: 'Basic abc123' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should reject tokens without iss claim', () => {
    const token = signToken({ aud: 'control-plane' });
    const ctx = createMockContext({ authorization: `Bearer ${token}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should reject tokens from untrusted services', () => {
    const token = signToken({ iss: 'unknown-service', aud: 'control-plane' });
    const ctx = createMockContext({ authorization: `Bearer ${token}` });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should reject tokens with wrong audience', () => {
    const token = signToken({ iss: 'recruit-app', aud: 'wrong-audience' });
    const ctx = createMockContext({ authorization: `Bearer ${token}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should reject expired tokens', () => {
    const token = jwt.sign(
      { iss: 'recruit-app', aud: 'control-plane' },
      callerPrivateKey,
      { algorithm: 'RS256', expiresIn: -10 },
    );
    const ctx = createMockContext({ authorization: `Bearer ${token}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should reject tokens signed with wrong key', () => {
    const wrongPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const token = signToken({ iss: 'recruit-app', aud: 'control-plane' }, wrongPair.privateKey);
    const ctx = createMockContext({ authorization: `Bearer ${token}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should accept valid tokens and attach payload to request', () => {
    const token = signToken({
      iss: 'recruit-app',
      aud: 'control-plane',
      scopes: ['tenants:read'],
    });
    const ctx = createMockContext({ authorization: `Bearer ${token}` });

    expect(guard.canActivate(ctx)).toBe(true);

    const request = ctx.switchToHttp().getRequest();
    expect(request.serviceAuth).toBeDefined();
    expect(request.serviceAuth.iss).toBe('recruit-app');
    expect(request.serviceAuth.aud).toBe('control-plane');
    expect(request.serviceAuth.scopes).toEqual(['tenants:read']);
  });
});
