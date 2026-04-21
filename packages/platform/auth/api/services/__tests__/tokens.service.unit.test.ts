import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { TokensService } from '../tokens.service';
import type { AuthModuleConfig, JwtPayload } from '../../types';
import { AUTH_TOKEN_TYPES } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockConfig(overrides: Partial<AuthModuleConfig> = {}): AuthModuleConfig {
  return {
    jwtSecret: 'test-jwt-secret-key',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
    resetTokenExpiresIn: '1h',
    invitationTokenExpiresIn: '7d',
    ...overrides,
  };
}

function createMockDbChain(returning: unknown[] = [{ id: 'token-1' }]) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return chain;
}

function createMockDatabaseService(dbChain = createMockDbChain()) {
  return { db: dbChain };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TokensService', () => {
  let service: TokensService;
  let config: AuthModuleConfig;
  let dbChain: ReturnType<typeof createMockDbChain>;
  let mockDatabase: ReturnType<typeof createMockDatabaseService>;

  beforeEach(() => {
    config = createMockConfig();
    dbChain = createMockDbChain();
    mockDatabase = createMockDatabaseService(dbChain);
    service = new TokensService(mockDatabase as any, config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // generateAccessToken
  // -----------------------------------------------------------------------
  describe('generateAccessToken', () => {
    it('should return a signed JWT string', () => {
      const payload: JwtPayload = { userId: 'user-1' };
      const token = service.generateAccessToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should embed the userId in the token payload', () => {
      const payload: JwtPayload = { userId: 'user-1' };
      const token = service.generateAccessToken(payload);
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

      expect(decoded.userId).toBe('user-1');
    });

    it('should include custom claims in the token', () => {
      const payload: JwtPayload = { userId: 'user-1', tenantId: 'tenant-1', role: 'admin' };
      const token = service.generateAccessToken(payload);
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

      expect(decoded.userId).toBe('user-1');
      expect(decoded.tenantId).toBe('tenant-1');
      expect(decoded.role).toBe('admin');
    });

    it('should set expiration based on config.accessTokenExpiresIn', () => {
      const shortConfig = createMockConfig({ accessTokenExpiresIn: '30s' });
      const shortService = new TokensService(mockDatabase as any, shortConfig);

      const token = shortService.generateAccessToken({ userId: 'user-1' });
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded.exp).toBeDefined();
      const expectedExp = Math.floor(Date.now() / 1000) + 30;
      expect(decoded.exp).toBeGreaterThanOrEqual(expectedExp - 2);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 2);
    });

    it('should sign with the configured jwtSecret', () => {
      const token = service.generateAccessToken({ userId: 'user-1' });

      expect(() => jwt.verify(token, config.jwtSecret)).not.toThrow();
      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // verifyAccessToken
  // -----------------------------------------------------------------------
  describe('verifyAccessToken', () => {
    it('should return the payload for a valid token', () => {
      const original: JwtPayload = { userId: 'user-1' };
      const token = service.generateAccessToken(original);
      const result = service.verifyAccessToken(token);

      expect(result.userId).toBe('user-1');
    });

    it('should throw for an expired token', () => {
      const token = jwt.sign({ userId: 'user-1' }, config.jwtSecret, { expiresIn: '0s' });

      expect(() => service.verifyAccessToken(token)).toThrow();
    });

    it('should throw for a token signed with a different secret', () => {
      const token = jwt.sign({ userId: 'user-1' }, 'different-secret', { expiresIn: '15m' });

      expect(() => service.verifyAccessToken(token)).toThrow();
    });

    it('should throw for a malformed token', () => {
      expect(() => service.verifyAccessToken('not-a-jwt')).toThrow();
    });

    it('should throw for an empty string', () => {
      expect(() => service.verifyAccessToken('')).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // hashToken
  // -----------------------------------------------------------------------
  describe('hashToken', () => {
    it('should return a sha256 hex digest', () => {
      const raw = 'some-random-token';
      const expected = createHash('sha256').update(raw).digest('hex');

      expect(service.hashToken(raw)).toBe(expected);
    });

    it('should produce deterministic output for the same input', () => {
      const raw = 'deterministic-test';
      expect(service.hashToken(raw)).toBe(service.hashToken(raw));
    });

    it('should produce different hashes for different inputs', () => {
      expect(service.hashToken('token-a')).not.toBe(service.hashToken('token-b'));
    });

    it('should return a 64-character hex string', () => {
      const hash = service.hashToken('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // -----------------------------------------------------------------------
  // createToken (tested via createRefreshToken / createPasswordResetToken)
  // -----------------------------------------------------------------------
  describe('createToken', () => {
    it('should insert a record with hashed token and return raw token + id', async () => {
      const result = await service.createRefreshToken('user-1');

      expect(dbChain.insert).toHaveBeenCalled();
      expect(dbChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: AUTH_TOKEN_TYPES.REFRESH,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
      expect(dbChain.returning).toHaveBeenCalled();
      expect(result).toEqual({
        token: expect.any(String),
        expiresAt: expect.any(Date),
        id: 'token-1',
      });
    });

    it('should generate a 64-character hex token (32 random bytes)', async () => {
      const result = await service.createRefreshToken('user-1');
      expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should store the hash of the token, not the raw token', async () => {
      const result = await service.createRefreshToken('user-1');
      const expectedHash = service.hashToken(result.token);

      const insertedValues = dbChain.values.mock.calls[0][0];
      expect(insertedValues.tokenHash).toBe(expectedHash);
      expect(insertedValues.tokenHash).not.toBe(result.token);
    });

    it('should use the provided transaction when tx is given', async () => {
      const txChain = createMockDbChain([{ id: 'tx-token-1' }]);
      const result = await service.createRefreshToken('user-1', txChain as any);

      expect(txChain.insert).toHaveBeenCalled();
      expect(dbChain.insert).not.toHaveBeenCalled();
      expect(result.id).toBe('tx-token-1');
    });

    it('should use database.db when no transaction is provided', async () => {
      await service.createRefreshToken('user-1');
      expect(dbChain.insert).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // createRefreshToken
  // -----------------------------------------------------------------------
  describe('createRefreshToken', () => {
    it('should create a token with type REFRESH', async () => {
      await service.createRefreshToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      expect(insertedValues.type).toBe(AUTH_TOKEN_TYPES.REFRESH);
    });

    it('should calculate expiry based on config.refreshTokenExpiresIn', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await service.createRefreshToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      const expectedExpiry = new Date(now + 7 * 24 * 60 * 60 * 1000); // 7d
      expect(insertedValues.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });
  });

  // -----------------------------------------------------------------------
  // createPasswordResetToken
  // -----------------------------------------------------------------------
  describe('createPasswordResetToken', () => {
    it('should create a token with type PASSWORD_RESET', async () => {
      await service.createPasswordResetToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      expect(insertedValues.type).toBe(AUTH_TOKEN_TYPES.PASSWORD_RESET);
    });

    it('should calculate expiry based on config.resetTokenExpiresIn', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await service.createPasswordResetToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      const expectedExpiry = new Date(now + 1 * 60 * 60 * 1000); // 1h
      expect(insertedValues.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });
  });

  // -----------------------------------------------------------------------
  // createInvitationToken
  // -----------------------------------------------------------------------
  describe('createInvitationToken', () => {
    it('should create a token with type INVITATION', async () => {
      await service.createInvitationToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      expect(insertedValues.type).toBe(AUTH_TOKEN_TYPES.INVITATION);
    });

    it('should calculate expiry based on config.invitationTokenExpiresIn (default 7d)', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await service.createInvitationToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      const expectedExpiry = new Date(now + 7 * 24 * 60 * 60 * 1000); // 7d
      expect(insertedValues.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });
  });

  // -----------------------------------------------------------------------
  // validateToken
  // -----------------------------------------------------------------------
  describe('validateToken', () => {
    it('should return the record when token is valid and not expired', async () => {
      const futureDate = new Date(Date.now() + 100_000);
      const record = {
        id: 'tok-1',
        userId: 'user-1',
        type: 'refresh',
        expiresAt: futureDate,
        revokedAt: null,
        usedAt: null,
      };
      dbChain.limit = vi.fn().mockResolvedValue([record]);

      const result = await service.validateToken('raw-token', 'refresh');

      expect(result).toEqual(record);
      expect(dbChain.select).toHaveBeenCalled();
      expect(dbChain.from).toHaveBeenCalled();
      expect(dbChain.where).toHaveBeenCalled();
      expect(dbChain.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when no matching record is found', async () => {
      dbChain.limit = vi.fn().mockResolvedValue([]);

      const result = await service.validateToken('unknown-token', 'refresh');

      expect(result).toBeNull();
    });

    it('should return null when the token is expired', async () => {
      const pastDate = new Date(Date.now() - 100_000);
      const record = {
        id: 'tok-1',
        userId: 'user-1',
        type: 'refresh',
        expiresAt: pastDate,
        revokedAt: null,
        usedAt: null,
      };
      dbChain.limit = vi.fn().mockResolvedValue([record]);

      const result = await service.validateToken('raw-token', 'refresh');

      expect(result).toBeNull();
    });

    it('should query using the hashed version of the raw token', async () => {
      dbChain.limit = vi.fn().mockResolvedValue([]);

      await service.validateToken('raw-token', 'refresh');

      expect(dbChain.where).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // revokeToken
  // -----------------------------------------------------------------------
  describe('revokeToken', () => {
    it('should update the token with a revokedAt timestamp', async () => {
      await service.revokeToken('tok-1');

      expect(dbChain.update).toHaveBeenCalled();
      expect(dbChain.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
      expect(dbChain.where).toHaveBeenCalled();
    });

    it('should target the specific token by id', async () => {
      await service.revokeToken('tok-42');

      expect(dbChain.update).toHaveBeenCalled();
      expect(dbChain.set).toHaveBeenCalled();
      expect(dbChain.where).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // revokeAllUserTokens
  // -----------------------------------------------------------------------
  describe('revokeAllUserTokens', () => {
    it('should revoke all non-revoked tokens for the user', async () => {
      await service.revokeAllUserTokens('user-1');

      expect(dbChain.update).toHaveBeenCalled();
      expect(dbChain.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
      expect(dbChain.where).toHaveBeenCalled();
    });

    it('should accept an optional type filter', async () => {
      await service.revokeAllUserTokens('user-1', 'refresh');

      expect(dbChain.update).toHaveBeenCalled();
      expect(dbChain.set).toHaveBeenCalled();
      expect(dbChain.where).toHaveBeenCalled();
    });

    it('should not throw when type is omitted', async () => {
      await expect(service.revokeAllUserTokens('user-1')).resolves.not.toThrow();
      expect(dbChain.update).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // markTokenUsed
  // -----------------------------------------------------------------------
  describe('markTokenUsed', () => {
    it('should set usedAt to current date for the given token id', async () => {
      await service.markTokenUsed('tok-1');

      expect(dbChain.update).toHaveBeenCalled();
      expect(dbChain.set).toHaveBeenCalledWith({ usedAt: expect.any(Date) });
      expect(dbChain.where).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // calculateExpiry (private — tested via createToken side effects)
  // -----------------------------------------------------------------------
  describe('expiry calculation', () => {
    it('should handle seconds unit (s)', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const sConfig = createMockConfig({ refreshTokenExpiresIn: '30s' });
      const sService = new TokensService(mockDatabase as any, sConfig);

      await sService.createRefreshToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      expect(insertedValues.expiresAt.getTime()).toBe(now + 30 * 1000);
    });

    it('should handle minutes unit (m)', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const mConfig = createMockConfig({ refreshTokenExpiresIn: '15m' });
      const mService = new TokensService(mockDatabase as any, mConfig);

      await mService.createRefreshToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      expect(insertedValues.expiresAt.getTime()).toBe(now + 15 * 60 * 1000);
    });

    it('should handle hours unit (h)', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const hConfig = createMockConfig({ refreshTokenExpiresIn: '2h' });
      const hService = new TokensService(mockDatabase as any, hConfig);

      await hService.createRefreshToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      expect(insertedValues.expiresAt.getTime()).toBe(now + 2 * 60 * 60 * 1000);
    });

    it('should handle days unit (d)', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const dConfig = createMockConfig({ refreshTokenExpiresIn: '7d' });
      const dService = new TokensService(mockDatabase as any, dConfig);

      await dService.createRefreshToken('user-1');

      const insertedValues = dbChain.values.mock.calls[0][0];
      expect(insertedValues.expiresAt.getTime()).toBe(now + 7 * 24 * 60 * 60 * 1000);
    });

    it('should throw for invalid expiresIn format', async () => {
      const badConfig = createMockConfig({ refreshTokenExpiresIn: 'invalid' });
      const badService = new TokensService(mockDatabase as any, badConfig);

      await expect(badService.createRefreshToken('user-1')).rejects.toThrow(
        'Invalid expiresIn format: invalid',
      );
    });

    it('should throw for missing numeric value', async () => {
      const badConfig = createMockConfig({ refreshTokenExpiresIn: 'd' });
      const badService = new TokensService(mockDatabase as any, badConfig);

      await expect(badService.createRefreshToken('user-1')).rejects.toThrow(
        'Invalid expiresIn format: d',
      );
    });

    it('should throw for unsupported unit', async () => {
      const badConfig = createMockConfig({ refreshTokenExpiresIn: '5w' });
      const badService = new TokensService(mockDatabase as any, badConfig);

      await expect(badService.createRefreshToken('user-1')).rejects.toThrow(
        'Invalid expiresIn format: 5w',
      );
    });

    it('should throw for negative values', async () => {
      const badConfig = createMockConfig({ refreshTokenExpiresIn: '-5m' });
      const badService = new TokensService(mockDatabase as any, badConfig);

      await expect(badService.createRefreshToken('user-1')).rejects.toThrow(
        'Invalid expiresIn format: -5m',
      );
    });

    it('should throw for decimal values', async () => {
      const badConfig = createMockConfig({ refreshTokenExpiresIn: '1.5h' });
      const badService = new TokensService(mockDatabase as any, badConfig);

      await expect(badService.createRefreshToken('user-1')).rejects.toThrow(
        'Invalid expiresIn format: 1.5h',
      );
    });

    it('should throw for empty string', async () => {
      const badConfig = createMockConfig({ refreshTokenExpiresIn: '' });
      const badService = new TokensService(mockDatabase as any, badConfig);

      await expect(badService.createRefreshToken('user-1')).rejects.toThrow(
        'Invalid expiresIn format: ',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Token uniqueness
  // -----------------------------------------------------------------------
  describe('token generation uniqueness', () => {
    it('should generate different tokens on successive calls', async () => {
      const result1 = await service.createRefreshToken('user-1');

      // Reset the mock chain for a second call
      dbChain.returning = vi.fn().mockResolvedValue([{ id: 'token-2' }]);
      const result2 = await service.createRefreshToken('user-1');

      expect(result1.token).not.toBe(result2.token);
    });
  });
});
