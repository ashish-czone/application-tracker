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
    validateToken: vi.fn(),
    revokeToken: vi.fn().mockResolvedValue(undefined),
    revokeAllUserTokens: vi.fn().mockResolvedValue(undefined),
    markTokenUsed: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('AuthService', () => {
  let service: AuthService;
  let credentialsService: ReturnType<typeof createMockCredentialsService>;
  let tokensService: ReturnType<typeof createMockTokensService>;

  beforeEach(() => {
    credentialsService = createMockCredentialsService();
    tokensService = createMockTokensService();
    service = new AuthService(credentialsService as any, tokensService as any);
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
    it('should rotate refresh token and return new one', async () => {
      tokensService.validateToken = vi.fn().mockResolvedValue({
        id: 'old-rt', userId: 'u1', type: 'refresh',
      });

      const result = await service.refresh('old-refresh-token');

      expect(tokensService.revokeToken).toHaveBeenCalledWith('old-rt');
      expect(tokensService.createRefreshToken).toHaveBeenCalledWith('u1');
      expect(result.userId).toBe('u1');
      expect(result.token).toBe('refresh-token');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      tokensService.validateToken = vi.fn().mockResolvedValue(null);

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
    it('should reset password and revoke all refresh tokens', async () => {
      tokensService.validateToken = vi.fn().mockResolvedValue({
        id: 'prt-1', userId: 'u1', type: 'password_reset',
      });

      await service.resetPassword('valid-reset-token', 'new-password');

      expect(credentialsService.updateSecretHash).toHaveBeenCalledWith('u1', 'password', 'new-password');
      expect(tokensService.markTokenUsed).toHaveBeenCalledWith('prt-1');
      expect(tokensService.revokeAllUserTokens).toHaveBeenCalledWith('u1', 'refresh');
    });

    it('should throw UnauthorizedException for invalid reset token', async () => {
      tokensService.validateToken = vi.fn().mockResolvedValue(null);

      await expect(service.resetPassword('bad-token', 'new-pass'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
