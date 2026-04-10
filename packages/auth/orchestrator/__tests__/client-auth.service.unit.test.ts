import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientAuthService } from '../client-auth.service';

describe('ClientAuthService', () => {
  let service: ClientAuthService;

  const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token', userId: 'u1' };
  const mockRefreshResult = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };

  beforeEach(() => {
    // Create instance without calling constructor (avoids injecting all NestJS deps)
    service = Object.create(ClientAuthService.prototype);

    // Stub the inherited parent methods
    service.register = vi.fn().mockResolvedValue(mockTokens);
    service.login = vi.fn().mockResolvedValue(mockTokens);
    service.refresh = vi.fn().mockResolvedValue(mockRefreshResult);
    service.loginWithProvider = vi.fn().mockResolvedValue(mockTokens);
  });

  describe('clientRegister', () => {
    it('should delegate to register with userType "client"', async () => {
      const data = { email: 'user@test.com', firstName: 'Jane', lastName: 'Doe', password: 'Pass1234' };

      const result = await service.clientRegister(data);

      expect(service.register).toHaveBeenCalledWith(data, 'client');
      expect(result).toEqual(mockTokens);
    });
  });

  describe('clientLogin', () => {
    it('should delegate to login with userType "client"', async () => {
      const result = await service.clientLogin('user@test.com', 'password123');

      expect(service.login).toHaveBeenCalledWith('user@test.com', 'password123', 'client');
      expect(result).toEqual(mockTokens);
    });
  });

  describe('clientRefresh', () => {
    it('should delegate to refresh with userType "client"', async () => {
      const result = await service.clientRefresh('old-refresh-token');

      expect(service.refresh).toHaveBeenCalledWith('old-refresh-token', 'client');
      expect(result).toEqual(mockRefreshResult);
    });
  });

  describe('clientOAuthLogin', () => {
    it('should delegate to loginWithProvider with userType "client"', async () => {
      const result = await service.clientOAuthLogin('google', 'auth-code-123', 'http://localhost/callback');

      expect(service.loginWithProvider).toHaveBeenCalledWith(
        'google',
        { provider: 'google', code: 'auth-code-123', redirectUri: 'http://localhost/callback' },
        'client',
      );
      expect(result).toEqual(mockTokens);
    });

    it('should pass correct credentials object for different providers', async () => {
      await service.clientOAuthLogin('github', 'gh-code', 'http://localhost/gh-callback');

      expect(service.loginWithProvider).toHaveBeenCalledWith(
        'github',
        { provider: 'github', code: 'gh-code', redirectUri: 'http://localhost/gh-callback' },
        'client',
      );
    });
  });
});
