import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { CredentialsService } from '../credentials.service';
import type { TokensService } from '../tokens.service';

function createMockCredentialsService(): CredentialsService {
  return {
    findByProviderAndIdentifier: vi.fn(),
    findByUserId: vi.fn(),
    createPasswordCredential: vi.fn(),
    verifyPassword: vi.fn(),
    updateSecretHash: vi.fn(),
  } as any;
}

function createMockTokensService(): TokensService {
  return {
    generateAccessToken: vi.fn().mockReturnValue('access-token'),
    verifyAccessToken: vi.fn().mockReturnValue({ userId: 'u1' }),
    createRefreshToken: vi.fn().mockResolvedValue({ token: 'refresh-token', expiresAt: new Date(), id: 'rt-1' }),
    createPasswordResetToken: vi.fn().mockResolvedValue({ token: 'reset-token', expiresAt: new Date(), id: 'prt-1' }),
    createInvitationToken: vi.fn().mockResolvedValue({ token: 'invite-token', expiresAt: new Date(), id: 'inv-1' }),
    validateToken: vi.fn(),
    revokeToken: vi.fn().mockResolvedValue(undefined),
    revokeAllUserTokens: vi.fn().mockResolvedValue(undefined),
    markTokenUsed: vi.fn().mockResolvedValue(undefined),
    hashToken: vi.fn().mockReturnValue('hashed-token'),
  } as any;
}

function createMockDatabaseService(txResults: { select?: unknown[] } = {}) {
  const txChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(txResults.select ?? []),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-rt', token: 'new-token' }]),
      }),
    }),
    select: vi.fn().mockReturnThis(),
  };

  return {
    db: {
      transaction: vi.fn().mockImplementation(async (cb: any) => cb(txChain)),
    },
    _txChain: txChain,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let credentialsService: ReturnType<typeof createMockCredentialsService>;
  let tokensService: ReturnType<typeof createMockTokensService>;
  let mockDatabase: ReturnType<typeof createMockDatabaseService>;

  beforeEach(() => {
    credentialsService = createMockCredentialsService();
    tokensService = createMockTokensService();
    mockDatabase = createMockDatabaseService();
    service = new AuthService(credentialsService as any, tokensService as any, mockDatabase as any);
  });

  describe('verifyPasswordCredential', () => {
    it('should return userId on valid credentials', async () => {
      credentialsService.findByProviderAndIdentifier = vi.fn().mockResolvedValue({
        userId: 'u1', secretHash: 'hashed', provider: 'password',
      });
      credentialsService.verifyPassword = vi.fn().mockResolvedValue(true);

      const result = await service.verifyPasswordCredential('user@test.com', 'password123');

      expect(result).toEqual({ userId: 'u1' });
    });

    it('should throw UnauthorizedException when credential not found', async () => {
      credentialsService.findByProviderAndIdentifier = vi.fn().mockResolvedValue(null);

      await expect(service.verifyPasswordCredential('unknown@test.com', 'pass'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      credentialsService.findByProviderAndIdentifier = vi.fn().mockResolvedValue({
        userId: 'u1', secretHash: 'hashed', provider: 'password',
      });
      credentialsService.verifyPassword = vi.fn().mockResolvedValue(false);

      await expect(service.verifyPasswordCredential('user@test.com', 'wrong'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should not reveal whether user exists or password is wrong', async () => {
      credentialsService.findByProviderAndIdentifier = vi.fn().mockResolvedValue(null);

      try {
        await service.verifyPasswordCredential('unknown@test.com', 'pass');
      } catch (e: any) {
        expect(e.message).toBe('Invalid credentials');
      }

      credentialsService.findByProviderAndIdentifier = vi.fn().mockResolvedValue({
        userId: 'u1', secretHash: 'hashed', provider: 'password',
      });
      credentialsService.verifyPassword = vi.fn().mockResolvedValue(false);

      try {
        await service.verifyPasswordCredential('user@test.com', 'wrong');
      } catch (e: any) {
        expect(e.message).toBe('Invalid credentials');
      }
    });
  });

  describe('generateAccessToken / verifyAccessToken', () => {
    it('should delegate to tokens service', () => {
      const result = service.generateAccessToken({ userId: 'u1' });
      expect(result).toBe('access-token');
      expect(tokensService.generateAccessToken).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('should verify and return payload', () => {
      const result = service.verifyAccessToken('some-token');
      expect(result).toEqual({ userId: 'u1' });
    });
  });

  describe('refresh', () => {
    it('should rotate refresh token within a transaction', async () => {
      // Mock: SELECT FOR UPDATE finds the token
      mockDatabase = createMockDatabaseService({
        select: [{ id: 'old-rt', userId: 'u1', type: 'refresh', expiresAt: new Date(Date.now() + 100000) }],
      });
      service = new AuthService(credentialsService as any, tokensService as any, mockDatabase as any);

      const result = await service.refresh('old-refresh-token');

      expect(tokensService.hashToken).toHaveBeenCalledWith('old-refresh-token');
      expect(mockDatabase.db.transaction).toHaveBeenCalled();
      expect(tokensService.createRefreshToken).toHaveBeenCalled();
      expect(result.userId).toBe('u1');
    });

    it('should throw UnauthorizedException when token not found in transaction', async () => {
      // Mock: SELECT FOR UPDATE finds nothing
      mockDatabase = createMockDatabaseService({ select: [] });
      service = new AuthService(credentialsService as any, tokensService as any, mockDatabase as any);

      await expect(service.refresh('bad-token'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      tokensService.validateToken = vi.fn().mockResolvedValue({ id: 'rt-1' });

      await service.logout('some-refresh-token');

      expect(tokensService.revokeToken).toHaveBeenCalledWith('rt-1');
    });

    it('should silently succeed if token is already invalid', async () => {
      tokensService.validateToken = vi.fn().mockResolvedValue(null);

      await expect(service.logout('bad-token')).resolves.toBeUndefined();
    });
  });

  describe('logoutAll', () => {
    it('should revoke all refresh tokens for user', async () => {
      await service.logoutAll('u1');

      expect(tokensService.revokeAllUserTokens).toHaveBeenCalledWith('u1', 'refresh');
    });
  });

  describe('changePassword', () => {
    it('should update password when old password is correct', async () => {
      credentialsService.findByUserId = vi.fn().mockResolvedValue([
        { provider: 'password', secretHash: 'old-hash', userId: 'u1' },
      ]);
      credentialsService.verifyPassword = vi.fn().mockResolvedValue(true);

      await service.changePassword('u1', 'old-pass', 'new-pass');

      expect(credentialsService.updateSecretHash).toHaveBeenCalledWith('u1', 'password', 'new-pass');
    });

    it('should throw UnauthorizedException when old password is wrong', async () => {
      credentialsService.findByUserId = vi.fn().mockResolvedValue([
        { provider: 'password', secretHash: 'old-hash', userId: 'u1' },
      ]);
      credentialsService.verifyPassword = vi.fn().mockResolvedValue(false);

      await expect(service.changePassword('u1', 'wrong', 'new-pass'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no password credential exists', async () => {
      credentialsService.findByUserId = vi.fn().mockResolvedValue([
        { provider: 'google', userId: 'u1' },
      ]);

      await expect(service.changePassword('u1', 'old', 'new'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create token when credential exists', async () => {
      credentialsService.findByProviderAndIdentifier = vi.fn().mockResolvedValue({
        userId: 'u1', provider: 'password',
      });

      const result = await service.createPasswordResetToken('user@test.com');

      expect(tokensService.revokeAllUserTokens).toHaveBeenCalledWith('u1', 'password_reset');
      expect(tokensService.createPasswordResetToken).toHaveBeenCalledWith('u1');
      expect(result.token).toBe('reset-token');
    });

    it('should return empty token silently when credential not found (prevents enumeration)', async () => {
      credentialsService.findByProviderAndIdentifier = vi.fn().mockResolvedValue(null);

      const result = await service.createPasswordResetToken('unknown@test.com');

      expect(result.token).toBe('');
      expect(tokensService.createPasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password within a transaction and revoke refresh tokens', async () => {
      mockDatabase = createMockDatabaseService({
        select: [{ id: 'prt-1', userId: 'u1', type: 'password_reset', expiresAt: new Date(Date.now() + 100000) }],
      });
      service = new AuthService(credentialsService as any, tokensService as any, mockDatabase as any);

      await service.resetPassword('valid-reset-token', 'new-password');

      expect(tokensService.hashToken).toHaveBeenCalledWith('valid-reset-token');
      expect(mockDatabase.db.transaction).toHaveBeenCalled();
      expect(credentialsService.updateSecretHash).toHaveBeenCalled();
      expect(tokensService.revokeAllUserTokens).toHaveBeenCalledWith('u1', 'refresh');
    });

    it('should throw UnauthorizedException when token not found in transaction', async () => {
      mockDatabase = createMockDatabaseService({ select: [] });
      service = new AuthService(credentialsService as any, tokensService as any, mockDatabase as any);

      await expect(service.resetPassword('bad-token', 'new-pass'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createInvitationToken', () => {
    it('should revoke any outstanding invitation tokens then create a fresh one', async () => {
      const result = await service.createInvitationToken('u1');

      expect(tokensService.revokeAllUserTokens).toHaveBeenCalledWith('u1', 'invitation');
      expect(tokensService.createInvitationToken).toHaveBeenCalledWith('u1', undefined);
      expect(result.token).toBe('invite-token');
    });
  });

  describe('acceptInvitation', () => {
    /**
     * Build a tx mock where select() returns a queue of results in order, so
     * we can simulate: (1) token row found, (2) user row found. Each call to
     * .limit() shifts the next pre-loaded result.
     */
    function createAcceptInvitationMockDatabase(selects: unknown[][]) {
      const queue = [...selects];
      const txChain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(async () => queue.shift() ?? []),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        select: vi.fn(),
      };
      txChain.select = vi.fn().mockReturnValue(txChain);

      return {
        db: {
          transaction: vi.fn().mockImplementation(async (cb: any) => cb(txChain)),
        },
        _txChain: txChain,
      };
    }

    it('should create credential + stamp acceptedAt + consume token in one transaction', async () => {
      const tokenRow = { id: 'inv-1', userId: 'u1', type: 'invitation', expiresAt: new Date(Date.now() + 100000) };
      const userRow = { id: 'u1', email: 'invited@test.com', acceptedAt: null, deletedAt: null };
      const db = createAcceptInvitationMockDatabase([[tokenRow], [userRow]]);
      service = new AuthService(credentialsService as any, tokensService as any, db as any);

      const result = await service.acceptInvitation('valid-invite-token', 'newpassword123');

      expect(tokensService.hashToken).toHaveBeenCalledWith('valid-invite-token');
      expect(db.db.transaction).toHaveBeenCalled();
      expect(credentialsService.createPasswordCredential).toHaveBeenCalledWith(
        'u1', 'invited@test.com', 'newpassword123', expect.anything(),
      );
      expect(db._txChain.update).toHaveBeenCalled();
      expect(result).toEqual({ userId: 'u1' });
    });

    it('should throw UnauthorizedException when token not found', async () => {
      const db = createAcceptInvitationMockDatabase([[]]);
      service = new AuthService(credentialsService as any, tokensService as any, db as any);

      await expect(service.acceptInvitation('bad-token', 'pw'))
        .rejects.toThrow(UnauthorizedException);
      expect(credentialsService.createPasswordCredential).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when invited user has been soft-deleted', async () => {
      const tokenRow = { id: 'inv-1', userId: 'u1', type: 'invitation', expiresAt: new Date(Date.now() + 100000) };
      const userRow = { id: 'u1', email: 'invited@test.com', acceptedAt: null, deletedAt: new Date() };
      const db = createAcceptInvitationMockDatabase([[tokenRow], [userRow]]);
      service = new AuthService(credentialsService as any, tokensService as any, db as any);

      await expect(service.acceptInvitation('valid-token', 'pw'))
        .rejects.toThrow(UnauthorizedException);
      expect(credentialsService.createPasswordCredential).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when invitation already accepted', async () => {
      const tokenRow = { id: 'inv-1', userId: 'u1', type: 'invitation', expiresAt: new Date(Date.now() + 100000) };
      const userRow = { id: 'u1', email: 'invited@test.com', acceptedAt: new Date(), deletedAt: null };
      const db = createAcceptInvitationMockDatabase([[tokenRow], [userRow]]);
      service = new AuthService(credentialsService as any, tokensService as any, db as any);

      await expect(service.acceptInvitation('valid-token', 'pw'))
        .rejects.toThrow(/already accepted/i);
      expect(credentialsService.createPasswordCredential).not.toHaveBeenCalled();
    });
  });
});
