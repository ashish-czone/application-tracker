import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { ServiceAuthClient } from '../service-auth-client';
import type { ServiceAuthConfig } from '../../types';

describe('ServiceAuthClient', () => {
  let privateKey: string;
  let publicKey: string;
  let client: ServiceAuthClient;

  beforeAll(() => {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;

    const config: ServiceAuthConfig = {
      serviceId: 'test-service',
      privateKey,
      trustedServices: { 'peer-service': publicKey },
    };
    client = new ServiceAuthClient(config);
  });

  describe('createToken', () => {
    it('should create a JWT with correct iss and aud claims', () => {
      const token = client.createToken('control-plane');
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;

      expect(decoded.iss).toBe('test-service');
      expect(decoded.aud).toBe('control-plane');
    });

    it('should include scopes when provided', () => {
      const token = client.createToken('control-plane', ['tenants:read', 'tenants:provision']);
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;

      expect(decoded.scopes).toEqual(['tenants:read', 'tenants:provision']);
    });

    it('should not include scopes when empty', () => {
      const token = client.createToken('control-plane', []);
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;

      expect(decoded.scopes).toBeUndefined();
    });

    it('should set default expiry of 5 minutes', () => {
      const token = client.createToken('control-plane');
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;

      const exp = decoded.exp as number;
      const iat = decoded.iat as number;
      expect(exp - iat).toBe(300);
    });

    it('should respect custom tokenTtl', () => {
      const customClient = new ServiceAuthClient({
        serviceId: 'test-service',
        privateKey,
        trustedServices: {},
        tokenTtl: 60,
      });

      const token = customClient.createToken('control-plane');
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;

      const exp = decoded.exp as number;
      const iat = decoded.iat as number;
      expect(exp - iat).toBe(60);
    });
  });

  describe('getAuthHeaders', () => {
    it('should return Authorization header with Bearer prefix', () => {
      const headers = client.getAuthHeaders('control-plane');

      expect(headers.Authorization).toMatch(/^Bearer /);

      const token = headers.Authorization.slice(7);
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;
      expect(decoded.iss).toBe('test-service');
    });
  });
});
